import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const dealId = String(body.deal_id || '').trim()
    if (!dealId) return NextResponse.json({ error: 'deal_id required' }, { status: 400 })

    // deal
    const { data: deal, error: dErr } = await supabaseAdmin
      .from('deals')
      .select('id,user_id,company,premium,note,created_at')
      .eq('id', dealId)
      .single()

    if (dErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    // profile
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('id,first_name,last_name,email')
      .eq('id', deal.user_id)
      .single()

    const userName =
      [prof?.first_name, prof?.last_name].filter(Boolean).join(' ').trim() ||
      (prof?.email ? String(prof.email).split('@')[0] : '—')

    // product (stored in note as "Product: ___")
    const note = String((deal as any).note || '')
    const productMatch = note.match(/product_name:\s*(.+)/i) || note.match(/Product:\s*(.+)/i)
    const product = (productMatch?.[1] || '').trim()

    const carrierLine = [String(deal.company || '').trim(), product].filter(Boolean).join(' ').trim()

    const ap = Number(deal.premium || 0)

    // weekly ranking (simple: sum AP per user for week, compute rank)
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)

    const { data: weekDeals } = await supabaseAdmin
      .from('deals')
      .select('user_id,premium,created_at')
      .gte('created_at', weekStart.toISOString())
      .limit(100000)

    const map = new Map<string, number>()
    ;(weekDeals || []).forEach((r: any) => {
      const uid = r.user_id
      if (!uid) return
      const pn = Number(typeof r.premium === 'string' ? r.premium.replace(/[^0-9.]/g, '') : r.premium || 0)
      map.set(uid, (map.get(uid) || 0) + (Number.isFinite(pn) ? pn : 0))
    })

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    const rankIdx = sorted.findIndex(([uid]) => uid === deal.user_id)
    const rank = rankIdx >= 0 ? `${ordinal(rankIdx + 1)} place` : '—'

    // get webhook url from settings table or env
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) return NextResponse.json({ ok: true, skipped: 'No webhook url set' })

    const text =
      `${userName}\n` +
      `${carrierLine || String(deal.company || '').trim()}\n` +
      `AP: $${money(ap)}\n` +
      `Ranking: ${rank}`

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook failed' }, { status: 500 })
  }
}
