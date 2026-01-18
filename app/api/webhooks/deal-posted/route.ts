// ✅ FILE: /app/api/webhooks/deal-posted/route.ts  (CREATE THIS FILE)
// Sends Discord webhook when a deal is posted.
// Webhook URL is stored ONLY in Supabase (not exposed). We resolve it up the upline chain.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

function supabaseFromAuth(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  return {
    token,
    sb: createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    }),
  }
}

// Walk up upline chain until we find a webhook url
async function resolveWebhookUrl(startUserId: string) {
  // NOTE: requires profiles.discord_webhook_url column (text). If you named it differently, change here.
  let cur: string | null = startUserId
  const seen = new Set<string>()

  while (cur && !seen.has(cur)) {
    seen.add(cur)

    const { data: p } = await supabaseAdmin
      .from('profiles')
      .select('id,upline_id,discord_webhook_url')
      .eq('id', cur)
      .single()

    const url = (p as any)?.discord_webhook_url as string | null
    if (url && url.startsWith('http')) return url

    cur = ((p as any)?.upline_id as string | null) || null
  }

  return null
}

export async function POST(req: Request) {
  try {
    const { token, sb } = supabaseFromAuth(req)
    if (!token) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const { data: userRes, error: userErr } = await sb.auth.getUser()
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 })
    const uid = userRes.user?.id
    if (!uid) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const dealId = String(body?.deal_id || '').trim()
    if (!dealId) return NextResponse.json({ error: 'Missing deal_id' }, { status: 400 })

    // Load deal (service role)
    const { data: deal, error: dErr } = await supabaseAdmin
      .from('deals')
      .select('id,agent_id,full_name,phone,company,premium,coverage,policy_number,created_at')
      .eq('id', dealId)
      .single()

    if (dErr || !deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if ((deal as any).agent_id !== uid) {
      // Agents can only trigger webhook for their own inserted deal
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const webhookUrl = await resolveWebhookUrl(uid)
    if (!webhookUrl) return NextResponse.json({ ok: true, skipped: true }) // no webhook set

    const premium = Number((deal as any).premium || 0)
    const coverage = Number((deal as any).coverage || 0)
    const company = String((deal as any).company || '—')
    const name = String((deal as any).full_name || '—')

    // Discord webhook payload
    const payload = {
      content: null,
      embeds: [
        {
          title: 'New Deal Posted ✅',
          description: `**${name}** • ${company}`,
          fields: [
            { name: 'Premium', value: `$${premium.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, inline: true },
            { name: 'Coverage', value: coverage ? `$${coverage.toLocaleString()}` : '—', inline: true },
            { name: 'Policy #', value: String((deal as any).policy_number || '—'), inline: true },
            { name: 'Phone', value: String((deal as any).phone || '—'), inline: true },
          ],
          timestamp: new Date((deal as any).created_at || Date.now()).toISOString(),
        },
      ],
    }

    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!r.ok) return NextResponse.json({ error: 'Discord webhook failed' }, { status: 502 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
