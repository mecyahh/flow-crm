// ✅ REPLACE ENTIRE FILE: /app/api/webhooks/deal-posted/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function money(n: number) {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function rankEmoji(n: number) {
  if (n === 1) return '🥇'
  if (n === 2) return '🥈'
  if (n === 3) return '🥉'
  if (n <= 10) return '🔥'
  return '⭐️'
}

function toPremium(p: any) {
  const n =
    typeof p === 'number'
      ? p
      : typeof p === 'string'
      ? Number(p.replace(/[^0-9.]/g, ''))
      : Number(p || 0)
  return Number.isFinite(n) ? n : 0
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const dealId = String(body.deal_id || '').trim()
    if (!dealId) return NextResponse.json({ error: 'deal_id required' }, { status: 400 })

    // deal (✅ INCLUDE source)
    const { data: deal, error: dErr } = await supabaseAdmin
      .from('deals')
      .select('id,user_id,company,premium,note,created_at,source')
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

    // product (stored in note). Strip any "Effective" text permanently.
    const note = String((deal as any).note || '')
    const productMatch = note.match(/product_name:\s*(.+)/i) || note.match(/Product:\s*(.+)/i)
    const rawProduct = (productMatch?.[1] || '').trim()

    const product = rawProduct
      .replace(/\|\s*Effective:.*$/i, '')
      .replace(/Effective:\s*.*$/i, '')
      .trim()

    const carrierLine = [String(deal.company || '').trim(), product].filter(Boolean).join(' ').trim()

    // ✅ AP RULE: annual premium = premium * 12
    const premiumNum = toPremium((deal as any).premium)
    const ap = premiumNum * 12

    // weekly ranking (sum AP per user for current week)
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + diff)
    weekStart.setHours(0, 0, 0, 0)

    const { data: weekDeals, error: wErr } = await supabaseAdmin
      .from('deals')
      .select('user_id,premium,created_at')
      .gte('created_at', weekStart.toISOString())
      .limit(100000)

    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 400 })

    const map = new Map<string, number>()
    ;(weekDeals || []).forEach((r: any) => {
      const uid = r.user_id
      if (!uid) return
      const prem = toPremium(r.premium)
      map.set(uid, (map.get(uid) || 0) + prem * 12)
    })

    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    const rankIdx = sorted.findIndex(([uid]) => uid === deal.user_id)

    const rankNum = rankIdx >= 0 ? rankIdx + 1 : null
    const rankText = rankNum ? `${rankEmoji(rankNum)} ${ordinal(rankNum)} place` : '—'

    // ✅ Message
    const text =
      `${userName}\n` +
      `${carrierLine || String(deal.company || '').trim()}\n` +
      `AP: $${money(ap)}\n` +
      `Ranking: ${rankText}`

    // ✅ Always post to main 3 channels
    const baseUrls = [
      process.env.DISCORD_WEBHOOK_URL,
      process.env.DISCORD_WEBHOOK_URL_2,
      process.env.DISCORD_WEBHOOK_URL_3,
    ].filter(Boolean) as string[]

    // ✅ Conditionally post to inbound channel #4 if source is inbound
    const source = String((deal as any).source || '').trim().toLowerCase()
    const inboundUrl = process.env.DISCORD_WEBHOOK_URL_INBOUND
    const extraUrls =
      source === 'inbound' && inboundUrl ? [inboundUrl] : []

    const urls = [...baseUrls, ...extraUrls]

    if (!urls.length) return NextResponse.json({ ok: true, skipped: 'No webhook url set' })

    await Promise.all(
      urls.map((url) =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        }).catch(() => null)
      )
    )

    return NextResponse.json({
      ok: true,
      posted_to: urls.length,
      inbound_extra: extraUrls.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Webhook failed' }, { status: 500 })
  }
}
