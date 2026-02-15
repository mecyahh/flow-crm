import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function money(n: number) {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function prettyDay(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit' })
}

function nyNow() {
  // Use "America/New_York" wall clock
  const s = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  return new Date(s)
}

function startOfDayNY(d: Date) {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

function endOfDayNY(d: Date) {
  const e = startOfDayNY(d)
  e.setDate(e.getDate() + 1)
  return e
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const force = url.searchParams.get('force') === '1'
    const dry = url.searchParams.get('dry') === '1'
    const manual = url.searchParams.get('manual') === '1'

    // ✅ schedule guard: only allow 8:00pm ET unless force/manual
    const nowNY = nyNow()
    const hr = nowNY.getHours()
    const min = nowNY.getMinutes()
    const isScheduled = hr === 20 && min === 0

    if (!force && !manual && !isScheduled) {
      return NextResponse.json({ ok: true, skipped: 'not scheduled time', now_et: nowNY.toString() })
    }

    const dayStart = startOfDayNY(nowNY)
    const dayEnd = endOfDayNY(nowNY)

    // ✅ Pull today’s deals (all agents who wrote today)
    const { data: deals, error } = await supabaseAdmin
      .from('deals')
      .select('user_id,premium,created_at')
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString())
      .limit(100000)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Sum AP per user_id
    const apByUser = new Map<string, number>()
    ;(deals || []).forEach((r: any) => {
      const uid = r.user_id
      if (!uid) return
      const ap = toPremium(r.premium) * 12
      apByUser.set(uid, (apByUser.get(uid) || 0) + ap)
    })

    // Only writers
    const writers = Array.from(apByUser.entries())
      .filter(([, ap]) => ap > 0)
      .sort((a, b) => b[1] - a[1])

    if (!writers.length) {
      return NextResponse.json({ ok: true, posted: false, reason: 'no writers today' })
    }

    // Fetch names for writers
    const ids = writers.map(([uid]) => uid)
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id,first_name,last_name,email')
      .in('id', ids)
      .limit(10000)

    const nameById = new Map<string, string>()
    ;(profs || []).forEach((p: any) => {
      const n = `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim()
      nameById.set(p.id, n || (p.email ? String(p.email).split('@')[0] : 'Agent'))
    })

    const lines: string[] = []
    lines.push(`🎖️DAILY LEADERBOARD🎖️`)
    lines.push(`${prettyDay(nowNY)}`)
    lines.push('')

    writers.forEach(([uid, ap], idx) => {
      const name = nameById.get(uid) || 'Agent'
      const rank = idx + 1
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''
      const prefix = medal ? `${medal} ${rank}.` : `${rank}.`
      lines.push(`${prefix} ${name} — $${money(ap)} AP`)
    })

    const totalAp = writers.reduce((s, [, ap]) => s + ap, 0)
    lines.push('')
    lines.push('—————————')
    lines.push(`🔥 Total AP Today: $${money(totalAp)}`)

    const content = lines.join('\n')

    if (dry) {
      return NextResponse.json({
        ok: true,
        dry: true,
        writers: writers.length,
        total_ap: totalAp,
        preview: content,
      })
    }

    // ✅ Post ONLY to original webhook (your main channel)
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) return NextResponse.json({ ok: true, posted: false, skipped: 'No DISCORD_WEBHOOK_URL set' })

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    return NextResponse.json({ ok: true, posted: true, writers: writers.length, total_ap: totalAp })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'leaderboard failed' }, { status: 500 })
  }
}
