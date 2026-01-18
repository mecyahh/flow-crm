// ✅ FILE: /app/api/webhooks/deal-posted/route.ts  (CREATE THIS FILE)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Put your Discord webhook in Vercel env vars:
// DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/...
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL!

function jsonError(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code })
}

function startOfWeekMon(d: Date) {
  const x = new Date(d)
  const day = x.getDay() // Sun=0
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
  // If you're storing MONTHLY premium, this is correct.
  // If you're storing ANNUAL premium already, change this to: return premium
  return premium * 12
}

export async function POST(req: Request) {
  try {
    if (!DISCORD_WEBHOOK_URL) return jsonError('Missing DISCORD_WEBHOOK_URL', 500)

    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return jsonError('Unauthorized', 401)

    const { deal_id } = await req.json()
    if (!deal_id) return jsonError('Missing deal_id')

    // Verify the caller is logged in (agent token)
    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userRes, error: userErr } = await supaUser.auth.getUser()
    if (userErr || !userRes.user) return jsonError('Unauthorized', 401)

    // Use service role to read everything needed + compute rank
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE)

    // Load deal
    const { data: deal, error: dealErr } = await admin
      .from('deals')
      .select('id, agent_id, company, premium, policy_number, created_at')
      .eq('id', deal_id)
      .single()

    if (dealErr || !deal) return jsonError('Deal not found', 404)

    // Load agent profile name
    const { data: prof } = await admin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', deal.agent_id)
      .single()

    const name =
      `${(prof?.first_name || '').trim()} ${(prof?.last_name || '').trim()}`.trim() ||
      (prof?.email || 'Agent')

    const company = (deal.company || '—').trim()
    const product = (deal.policy_number || '—').trim() // ← replace with deal.product if you add a product column later

    const premiumNum =
      typeof deal.premium === 'number'
        ? deal.premium
        : typeof deal.premium === 'string'
        ? Number(deal.premium.replace(/[^0-9.]/g, ''))
        : Number(deal.premium || 0)

    const ap = annualize(Number.isFinite(premiumNum) ? premiumNum : 0)

    // Compute weekly rank by Annual Premium (Mon-Sun)
    const now = new Date()
    const weekStart = startOfWeekMon(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { data: weekDeals } = await admin
      .from('deals')
      .select('agent_id, premium, created_at')
      .gte('created_at', toISO(weekStart))
      .lt('created_at', toISO(weekEnd))
      .limit(50000)

    const sums = new Map<string, number>()
    ;(weekDeals || []).forEach((d: any) => {
      const p =
        typeof d.premium === 'number'
          ? d.premium
          : typeof d.premium === 'string'
          ? Number(String(d.premium).replace(/[^0-9.]/g, ''))
          : Number(d.premium || 0)
      const apv = annualize(Number.isFinite(p) ? p : 0)
      sums.set(d.agent_id, (sums.get(d.agent_id) || 0) + apv)
    })

    const sorted = Array.from(sums.entries()).sort((a, b) => b[1] - a[1])
    const rank = Math.max(1, sorted.findIndex(([aid]) => aid === deal.agent_id) + 1)

    const lines = [
      `**User Name:** ${name}`,
      `**Company:** ${company}`,
      `**Product:** ${product}`,
      `**AP:** $${fmtMoney(ap)}`,
      `**Leaderboard Standing (week):** ${rank}${ordinal(rank)} Place`,
    ]

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: lines.join('\n'),
      }),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // best-effort; never break agent submit
  }
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
