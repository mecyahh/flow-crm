// ✅ CREATE THIS FILE: /app/api/cron/agency-email/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET = process.env.CRON_SECRET!

// Resend (Vercel integration provides RESEND_API_KEY)
const RESEND_API_KEY = process.env.RESEND_API_KEY!

// Use your verified sender domain (change if you prefer a different From)
const EMAIL_FROM = process.env.AGENCY_REPORT_FROM || 'Flow <support@mail.yourflowcrm.com>'

// Safety caps
const MAX_PROFILES = 50000
const MAX_TEAM = 2500
const TOP_N = 50

function toPremium(p: any) {
  const n =
    typeof p === 'number'
      ? p
      : typeof p === 'string'
      ? Number(String(p).replace(/[^0-9.]/g, ''))
      : Number(p || 0)
  return Number.isFinite(n) ? n : 0
}

// ✅ AP RULE: annual premium = premium * 12
function toAP(premium: any) {
  return toPremium(premium) * 12
}

function fmtMoney0(n: number) {
  const v = Math.round(Number(n || 0))
  return v.toLocaleString()
}

function shortName(first: string | null, last: string | null, email: string | null) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return `${f} ${l ? l[0].toUpperCase() + '.' : ''}`.trim()
  if (email) return email.split('@')[0]
  return 'Agent'
}

// --- Time helpers (America/New_York local day) ---

function getNYOffsetMinutes(at: Date) {
  // Node 18+ supports shortOffset like "GMT-5"
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
    hour: '2-digit',
  })
  const parts = fmt.formatToParts(at)
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+0'
  // tz examples: "GMT-5", "GMT-04"
  const m = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const hh = Number(m[2] || 0)
  const mm = Number(m[3] || 0)
  return sign * (hh * 60 + mm)
}

function nyYMD(at: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(at)
  const y = parts.find((p) => p.type === 'year')?.value || '1970'
  const m = parts.find((p) => p.type === 'month')?.value || '01'
  const d = parts.find((p) => p.type === 'day')?.value || '01'
  return { y, m, d }
}

function nyDayBoundsUTC(now = new Date()) {
  const { y, m, d } = nyYMD(now)
  const offsetMin = getNYOffsetMinutes(now)

  // Construct local-midnight with correct offset, then Date parses into UTC
  const sign = offsetMin < 0 ? '-' : '+'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  const off = `${sign}${hh}:${mm}`

  const startLocal = `${y}-${m}-${d}T00:00:00${off}`
  const start = new Date(startLocal)

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  return { startISO: start.toISOString(), endISO: end.toISOString(), label: `${y}-${m}-${d}` }
}

function prettyDateLabelNY(now = new Date()) {
  return now.toLocaleDateString(undefined, {
    timeZone: 'America/New_York',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

// --- Team graph (owner + downlines) ---

type ProfLite = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  is_agency_owner: boolean | null
  upline_id: string | null
}

function buildChildrenMap(all: ProfLite[]) {
  const children = new Map<string, string[]>()
  for (const p of all) {
    const up = p.upline_id || null
    if (!up) continue
    if (!children.has(up)) children.set(up, [])
    children.get(up)!.push(p.id)
  }
  return children
}

function teamIdsForRoot(rootId: string, children: Map<string, string[]>) {
  const out: string[] = []
  const q: string[] = [rootId]
  const seen = new Set<string>()

  while (q.length) {
    const cur = q.shift()!
    if (seen.has(cur)) continue
    seen.add(cur)
    out.push(cur)

    const kids = children.get(cur) || []
    for (const k of kids) q.push(k)

    if (out.length >= MAX_TEAM) break
  }

  return out
}

function buildEmailText(ownerName: string, dateLabel: string, rows: { name: string; ap: number }[], total: number) {
  const lines: string[] = []
  lines.push(`Hey ${ownerName}, here’s what your personal agency produced today:`)
  lines.push('')
  lines.push(`🎖️SCOREBOARD · ${dateLabel} 🎖️`)
  lines.push('')

  rows.forEach((r, i) => {
    lines.push(`${i + 1}\t${r.name} - $${fmtMoney0(r.ap)}`)
  })

  lines.push('')
  lines.push(`TOTAL AP: $${fmtMoney0(total)}`)
  return lines.join('\n')
}

function escapeHtml(s: string) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildEmailHtml(ownerName: string, dateLabel: string, rows: { name: string; ap: number }[], total: number) {
  const tableRows = rows
    .map(
      (r, i) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.10);color:rgba(255,255,255,0.85);font-size:13px;">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.10);color:#fff;font-size:13px;font-weight:600;">${escapeHtml(
          r.name
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.10);color:#fff;font-size:13px;text-align:right;">$${fmtMoney0(
          r.ap
        )}</td>
      </tr>
    `
    )
    .join('')

  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#fff;background:#0b0f1a;padding:24px;">
    <div style="max-width:720px;margin:0 auto;border:1px solid rgba(255,255,255,0.10);border-radius:18px;background:rgba(255,255,255,0.04);overflow:hidden;">
      <div style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,0.10);">
        <div style="font-size:14px;color:rgba(255,255,255,0.70);">Flow · My Agency Numbers</div>
        <div style="font-size:20px;font-weight:800;margin-top:6px;">Hey ${escapeHtml(
          ownerName
        )}, here’s what your personal agency produced today:</div>
        <div style="margin-top:10px;font-size:13px;color:rgba(255,255,255,0.70);">🎖️SCOREBOARD · ${escapeHtml(
          dateLabel
        )} 🎖️</div>
      </div>

      <div style="padding:0 16px 14px;">
        <table style="width:100%;border-collapse:collapse;margin-top:12px;border:1px solid rgba(255,255,255,0.10);border-radius:14px;overflow:hidden;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;color:rgba(255,255,255,0.70);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.10);">#</th>
              <th style="text-align:left;padding:10px;color:rgba(255,255,255,0.70);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.10);">Agent</th>
              <th style="text-align:right;padding:10px;color:rgba(255,255,255,0.70);font-size:12px;border-bottom:1px solid rgba(255,255,255,0.10);">AP</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || `<tr><td colspan="3" style="padding:14px;color:rgba(255,255,255,0.70);">No production today.</td></tr>`}
          </tbody>
        </table>

        <div style="margin-top:12px;font-size:14px;font-weight:800;">
          TOTAL AP: <span style="color:#fff;">$${fmtMoney0(total)}</span>
        </div>

        <div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,0.55);">
          This report is isolated to your downline team so you can copy/paste cleanly into your own group chats.
        </div>
      </div>
    </div>
  </div>
  `
}

export async function GET(req: Request) {
  try {
    // Protect cron route
    const secret = req.headers.get('x-cron-secret') || ''
    if (!CRON_SECRET || secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE) {
      return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
    }
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY' }, { status: 500 })
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const resend = new Resend(RESEND_API_KEY)

    // Pull all profiles needed for graph + names (single fetch)
    const { data: allProfiles, error: pErr } = await admin
      .from('profiles')
      .select('id,email,first_name,last_name,is_agency_owner,upline_id')
      .limit(MAX_PROFILES)

    if (pErr || !allProfiles) {
      return NextResponse.json({ error: pErr?.message || 'profiles fetch failed' }, { status: 500 })
    }

    const profs = allProfiles as ProfLite[]
    const children = buildChildrenMap(profs)

    // Agency owners only
    const owners = profs.filter((p) => !!p.is_agency_owner && !!p.email)

    // Today bounds (NY local day)
    const now = new Date()
    const { startISO, endISO } = nyDayBoundsUTC(now)
    const dateLabel = prettyDateLabelNY(now)

    // Pull today’s deals once (for everyone), then slice per owner by teamIds
    const { data: deals, error: dErr } = await admin
      .from('deals')
      // IMPORTANT: your schema uses user_id (dashboard) or agent_id (analytics)
      // We'll try both safely by selecting both columns (one may be null depending on your table).
      .select('user_id,agent_id,premium,created_at')
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .limit(200000)

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 })
    }

    const profMap = new Map<string, ProfLite>()
    profs.forEach((p) => profMap.set(p.id, p))

    let sent = 0
    let skipped = 0
    const results: any[] = []

    for (const owner of owners) {
      const ownerId = owner.id
      const ownerEmail = (owner.email || '').trim()
      if (!ownerEmail) {
        skipped++
        continue
      }

      const teamIds = teamIdsForRoot(ownerId, children)
      const teamSet = new Set(teamIds)

      // Sum AP per agent in this owner’s team
      const sums = new Map<string, number>()

      ;(deals || []).forEach((r: any) => {
        const uid = (r.user_id || r.agent_id || null) as string | null
        if (!uid) return
        if (!teamSet.has(uid)) return
        sums.set(uid, (sums.get(uid) || 0) + toAP(r.premium))
      })

      const sorted = Array.from(sums.entries()).sort((a, b) => b[1] - a[1])
      const top = sorted.slice(0, TOP_N)

      const rows = top.map(([uid, ap]) => {
        const p = profMap.get(uid)
        const nm = shortName(p?.first_name || null, p?.last_name || null, p?.email || null)
        return { name: nm, ap }
      })

      const total = Array.from(sums.values()).reduce((s, v) => s + v, 0)

      const ownerName = shortName(owner.first_name, owner.last_name, owner.email)

      const subject = `My agency numbers · ${dateLabel}`
      const text = buildEmailText(ownerName, dateLabel, rows, total)
      const html = buildEmailHtml(ownerName, dateLabel, rows, total)

      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: ownerEmail,
          subject,
          text,
          html,
        })
        sent++
        results.push({ owner: ownerEmail, ok: true, teamSize: teamIds.length, deals: (deals || []).length })
      } catch (e: any) {
        results.push({ owner: ownerEmail, ok: false, error: e?.message || 'send failed' })
      }
    }

    return NextResponse.json({
      ok: true,
      owners: owners.length,
      sent,
      skipped,
      dateLabel,
      window: { startISO, endISO },
      sample: results.slice(0, 10),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'cron failed' }, { status: 500 })
  }
}
