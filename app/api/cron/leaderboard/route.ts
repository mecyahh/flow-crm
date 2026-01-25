import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

function fmtMoney0(n: number) {
  const v = Math.round(Number(n || 0))
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

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

function shortName(first: string | null, last: string | null, email: string | null) {
  const f = (first || '').trim()
  const l = (last || '').trim()

  if (f || l) {
    const li = l ? l[0].toUpperCase() + '.' : ''
    return `${f} ${li}`.trim()
  }

  if (email) return String(email).split('@')[0]
  return 'Agent'
}

function ymdInTZ(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)

  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return { y: Number(get('year')), m: Number(get('month')), day: Number(get('day')) }
}

function tzOffsetMinutes(d: Date, timeZone: string) {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)

  const m = s.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  if (!m) return 0
  const hh = Number(m[1])
  const mm = Number(m[2] || '0')
  return hh * 60 + (hh >= 0 ? mm : -mm)
}

function startOfDayTZ(now: Date, timeZone: string) {
  const { y, m, day } = ymdInTZ(now, timeZone)

  let guess = new Date(Date.UTC(y, m - 1, day, 0, 0, 0))

  for (let i = 0; i < 3; i++) {
    const offMin = tzOffsetMinutes(guess, timeZone)
    const corrected = new Date(Date.UTC(y, m - 1, day, 0, 0, 0) - offMin * 60 * 1000)
    if (Math.abs(corrected.getTime() - guess.getTime()) < 1000) {
      guess = corrected
      break
    }
    guess = corrected
  }

  return guess
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function dateLabelNY(now: Date) {
  return now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE) {
      return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
    }
    if (!DISCORD_WEBHOOK_URL) {
      return NextResponse.json({ error: 'Missing DISCORD_WEBHOOK_URL' }, { status: 500 })
    }
    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'Missing CRON_SECRET' }, { status: 500 })
    }

    // ✅ Protect cron route (Vercel cron uses query param)
    const url = new URL(req.url)
    const secretQ = url.searchParams.get('secret') || ''
    const secretH = req.headers.get('x-cron-secret') || ''
    const secret = secretQ || secretH
    if (secret !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const now = new Date()
    const dayStartNY = startOfDayTZ(now, 'America/New_York')
    const dayEndNY = addDays(dayStartNY, 1)

    const { data: deals, error: dErr } = await admin
      .from('deals')
      .select('user_id,agent_id,premium,created_at')
      .gte('created_at', dayStartNY.toISOString())
      .lt('created_at', dayEndNY.toISOString())
      .limit(100000)

    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 })

    const sums = new Map<string, number>()

    ;(deals || []).forEach((r: any) => {
      const uid = String(r.user_id || r.agent_id || '').trim()
      if (!uid) return
      const ap = toAP(r.premium)
      sums.set(uid, (sums.get(uid) || 0) + ap)
    })

    const sorted = Array.from(sums.entries()).sort((a, b) => b[1] - a[1])
    const ids = sorted.map(([id]) => id)

    const { data: profiles } = ids.length
      ? await admin.from('profiles').select('id,first_name,last_name,email').in('id', ids.slice(0, 200))
      : { data: [] as any[] }

    const pmap = new Map<string, any>()
    ;(profiles || []).forEach((p: any) => pmap.set(String(p.id), p))

    const header = `🎖️SCOREBOARD · ${dateLabelNY(now)} 🎖️`

    let total = 0
    sorted.forEach(([, ap]) => (total += ap))

    const lines: string[] = []
    lines.push(header)

    if (!sorted.length) {
      lines.push('No production posted yet today.')
      lines.push(`TOTAL AP: $0`)
    } else {
      sorted.slice(0, 50).forEach(([id, ap]) => {
        const p = pmap.get(String(id))
        const nm = shortName(p?.first_name ?? null, p?.last_name ?? null, p?.email ?? null)
        lines.push(`${nm} - $${fmtMoney0(ap)}`)
      })
      lines.push(`TOTAL AP: $${fmtMoney0(total)}`)
    }

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: lines.join('\n') }),
    })

    return NextResponse.json({
      ok: true,
      range: { start: dayStartNY.toISOString(), end: dayEndNY.toISOString() },
      posted: Math.min(sorted.length, 50),
      total_ap: total,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'cron failed' }, { status: 500 })
  }
}
