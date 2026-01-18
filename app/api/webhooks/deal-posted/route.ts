import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL! // add in Vercel env

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function startOfWeekMon(d: Date) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const base = new Date(d)
  base.setDate(d.getDate() + diff)
  base.setHours(0, 0, 0, 0)
  return base
}

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export async function POST(req: Request) {
  try {
    if (!DISCORD_WEBHOOK_URL) return NextResponse.json({ ok: true })

    const body = await req.json()
    const dealId = String(body?.deal_id || '')
    if (!dealId) return NextResponse.json({ error: 'Missing deal_id' }, { status: 400 })

    // get deal
    const { data: deal, error: dErr } = await admin
      .from('deals')
      .select('id, agent_id, full_name, company, product, premium, created_at')
      .eq('id', dealId)
      .single()

    if (dErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    // get agent profile
    const { data: prof } = await admin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', deal.agent_id)
      .maybeSingle()

    const agentName =
      `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
      (prof?.email ? prof.email.split('@')[0] : 'Agent')

    const prem = Number(deal.premium || 0)
    const ap = Math.round(prem * 12) // Annual Premium (assumes premium is monthly)

    // weekly standing (sum AP by agent this week)
    const now = new Date()
    const wk = startOfWeekMon(now).toISOString()

    const { data: weekDeals } = await admin
      .from('deals')
      .select('agent_id, premium, created_at')
      .gte('created_at', wk)
      .limit(50000)

    const map = new Map<string, number>()
    for (const r of weekDeals || []) {
      const p = Number((r as any).premium || 0)
      const ap2 = Math.round(p * 12)
      map.set((r as any).agent_id, (map.get((r as any).agent_id) || 0) + ap2)
    }

    const ranking = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    const place = Math.max(1, ranking.findIndex((x) => x[0] === deal.agent_id) + 1)
    const suffix =
      place % 10 === 1 && place % 100 !== 11
        ? 'st'
        : place % 10 === 2 && place % 100 !== 12
        ? 'nd'
        : place % 10 === 3 && place % 100 !== 13
        ? 'rd'
        : 'th'

    const payload = {
      content: [
        `**User Name:** ${agentName}`,
        `**Company:** ${deal.company || '—'}`,
        `**Product:** ${deal.product || '—'}`,
        `**AP:** $${money(ap)}`,
        `**Lead board Standing (week):** ${place}${suffix} Place`,
      ].join('\n'),
    }

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook failed' }, { status: 500 })
  }
}
