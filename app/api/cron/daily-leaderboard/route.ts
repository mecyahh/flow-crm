import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function money0(n: number) {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function fmtDateLabel(d: Date) {
  // "Monday, Feb 10"
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
  })
}

function medal(i: number) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return `${i + 1}.`
}

function toAP(premium: any) {
  const n =
    typeof premium === 'number'
      ? premium
      : typeof premium === 'string'
      ? Number(premium.replace(/[^0-9.]/g, ''))
      : Number(premium || 0)
  const prem = Number.isFinite(n) ? n : 0
  return prem * 12
}

function getNYParts(now = new Date()) {
  // Pull New York local parts reliably (DST-safe)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  const yyyy = Number(get('year'))
  const mm = Number(get('month'))
  const dd = Number(get('day'))
  const hh = Number(get('hour'))
  const mi = Number(get('minute'))

  return { yyyy, mm, dd, hh, mi }
}

function buildNYBoundsISO(yyyy: number, mm: number, dd: number) {
  // Create [start,end) for that NY day in UTC ISO strings
  // We do it by constructing a date string and letting Postgres handle timezone conversion.
  // We'll pass these as plain strings and use them in queries as timestamptz.
  const pad2 = (x: number) => String(x).padStart(2, '0')
  const day = `${yyyy}-${pad2(mm)}-${pad2(dd)}`
  const startNY = `${day} 00:00:00 America/New_York`
  const endNY = `${day} 00:00:00 America/New_York +1 day`
  return { startNY, endNY, dayISO: day }
}

export async function GET(req: Request) {
  try {
    // ✅ Protect endpoint (so random people can't trigger it)
    const secret = process.env.CRON_SECRET || ''
    const got = new URL(req.url).searchParams.get('secret') || ''
    if (!secret || got !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { yyyy, mm, dd, hh, mi } = getNYParts(new Date())

    // ✅ Only fire exactly at 15:00 or 21:00 NY time
    const is3pm = hh === 15 && mi === 0
    const is8pm = hh === 20 && mi === 0
if (!is3pm && !is8pm) {
  return NextResponse.json({ ok: true, skipped: 'not scheduled minute', ny: { yyyy, mm, dd, hh, mi } })
}

const slot = is3pm ? '3pm' : '8pm'
    const { startNY, endNY, dayISO } = buildNYBoundsISO(yyyy, mm, dd)

    // ✅ Idempotency: if already posted for this date+slot, do nothing
    const { data: existing } = await supabaseAdmin
      .from('leaderboard_posts')
      .select('id')
      .eq('local_date', dayISO)
      .eq('slot', slot)
      .limit(1)

    if (existing && existing.length) {
      return NextResponse.json({ ok: true, skipped: 'already posted', local_date: dayISO, slot })
    }

    // ✅ Pull today's deals (NY day) and rank by AP
    const { data: deals, error: dErr } = await supabaseAdmin
      .from('deals')
      .select('user_id,premium,created_at')
      // Postgres will interpret these strings as timestamptz because created_at is timestamptz
      .gte('created_at', startNY as any)
      .lt('created_at', endNY as any)
      .limit(100000)

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 400 })
    }

    const apByUser = new Map<string, number>()
    let totalAp = 0

    ;(deals || []).forEach((r: any) => {
      const uid = r.user_id
      if (!uid) return
      const ap = toAP(r.premium)
      totalAp += ap
      apByUser.set(uid, (apByUser.get(uid) || 0) + ap)
    })

    const sorted = Array.from(apByUser.entries()).sort((a, b) => b[1] - a[1])
    const top5 = sorted.slice(0, 5)

    // ✅ Fetch names for top users
    const ids = top5.map(([uid]) => uid)
    const nameMap = new Map<string, string>()

    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id,first_name,last_name,email')
        .in('id', ids)
        .limit(50)

      ;(profs || []).forEach((p: any) => {
        const n = `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim()
        nameMap.set(p.id, n || (p.email ? String(p.email).split('@')[0] : 'Agent'))
      })
    }

    // ✅ Build message in your exact format
    const labelDate = fmtDateLabel(new Date(`${dayISO}T12:00:00Z`)) // stable label
    const header = `🎖️DAILY LEADERBOARD🎖️\n${labelDate}\n\n`

    const lines =
      top5.length === 0
        ? ['No deals posted today.']
        : top5.map(([uid, ap], i) => {
            const nm = nameMap.get(uid) || 'Agent'
            const prefix = i < 3 ? `${medal(i)} ${i + 1}.` : `${i + 1}.`
            // NOTE: your sample includes "🥇 1." etc — keep that
            const shownPrefix = i < 3 ? `${medal(i)} ${i + 1}.` : `${i + 1}.`
            return `${shownPrefix} ${nm} — $${money0(ap)} AP`
          })

    const footer = `\n\n—————————\n🔥 Total AP Today: $${money0(totalAp)}`

    const text = header + lines.join('\n') + footer

    // ✅ Post ONLY to original webhook
    const url = process.env.DISCORD_WEBHOOK_URL
    if (!url) return NextResponse.json({ ok: true, skipped: 'DISCORD_WEBHOOK_URL not set' })

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })

    // ✅ Record that we posted (prevents duplicates)
    await supabaseAdmin.from('leaderboard_posts').insert({
      local_date: dayISO,
      slot,
      payload: text,
    })

    return NextResponse.json({ ok: true, posted: true, local_date: dayISO, slot })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'leaderboard cron failed' }, { status: 500 })
  }
}
