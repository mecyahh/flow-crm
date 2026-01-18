// ✅ FILE: /app/api/cron/leaderboard/route.ts  (CREATE THIS FILE)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL!
const CRON_SECRET = process.env.CRON_SECRET!

function startOfWeekMon(d: Date) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function toISO(d: Date) {
  return d.toISOString()
}

function fmtMoney(n: number) {
  const v = Math.round(n)
  return v.toLocaleString()
}

function annualize(premium: number) {
  // If premium is ANNUAL already, change to: return premium
  return premium * 12
}

function shortName(first: string | null, last: string | null, email: string | null) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return `${f} ${l ? l[0].toUpperCase() + '.' : ''}`.trim()
  if (email) return email.split('@')[0]
  return 'Agent'
}

export async function GET(req: Request) {
  try {
    if (!DISCORD_WEBHOOK_URL) return NextResponse.json({ error: 'Missing DISCORD_WEBHOOK_URL' }, { status: 500 })
    if (!CRON_SECRET) return NextResponse.json({ error: 'Missing CRON_SECRET' }, { status: 500 })

    // Protect cron route
    const secret = req.headers.get('x-cron-secret') || ''
    if (secret !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    const now = new Date()
    const weekStart = startOfWeekMon(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { data: deals } = await admin
      .from('deals')
      .select('agent_id, premium, created_at')
      .gte('created_at', toISO(weekStart))
      .lt('created_at', toISO(weekEnd))
      .limit(50000)

    const sums = new Map<string, number>()
    ;(deals || []).forEach((d: any) => {
      const p =
        typeof d.premium === 'number'
          ? d.premium
          : typeof d.premium === 'string'
          ? Number(String(d.premium).replace(/[^0-9.]/g, ''))
          : Number(d.premium || 0)
      const ap = annualize(Number.isFinite(p) ? p : 0)
      sums.set(d.agent_id, (sums.get(d.agent_id) || 0) + ap)
    })

    const sorted = Array.from(sums.entries()).sort((a, b) => b[1] - a[1])

    const agentIds = sorted.map(([id]) => id)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', agentIds.slice(0, 100)) // pull names for top 100

    const profMap = new Map<string, any>()
    ;(profiles || []).forEach((p: any) => profMap.set(p.id, p))

    const dateLabel = now.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })

    const lines: string[] = []
    lines.push(`💰**LEADERBOARD · ${dateLabel}** :trophy:`)
    lines.push('')

    let total = 0
    sorted.forEach(([, ap]) => (total += ap))

    sorted.slice(0, 50).forEach(([id, ap], idx) => {
      const p = profMap.get(id)
      const nm = shortName(p?.first_name || null, p?.last_name || null, p?.email || null)

      const medal =
        idx === 0 ? ' :first_place:' : idx === 1 ? ' :second_place:' : idx === 2 ? ' :third_place:' : ''

      lines.push(`${idx + 1}. ${nm} - $${fmtMoney(ap)}${medal}`)
    })

    lines.push('')
    lines.push(`**TOTAL AP:** $${fmtMoney(total)}`)

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: lines.join('\n') }),
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'cron failed' }, { status: 500 })
  }
}
