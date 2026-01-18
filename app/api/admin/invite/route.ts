// /app/api/admin/invite/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type Body = {
  email: string
  first_name?: string
  last_name?: string
  upline_id?: string | null
  comp?: number
  is_agency_owner?: boolean
  theme?: string
  role?: 'agent' | 'admin'
}

async function requireAdminOrOwner(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!token) return { ok: false as const, status: 401, error: 'Missing auth token' }

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userRes?.user) {
    return { ok: false as const, status: 401, error: 'Invalid session' }
  }

  const uid = userRes.user.id
  const { data: me, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, is_agency_owner')
    .eq('id', uid)
    .single()

  if (profErr || !me) return { ok: false as const, status: 403, error: 'No profile / not allowed' }

  const allowed = me.role === 'admin' || me.is_agency_owner === true
  if (!allowed) return { ok: false as const, status: 403, error: 'Not authorized' }

  return { ok: true as const, uid }
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdminOrOwner(req)
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const body = (await req.json()) as Body

    const email = (body.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const first_name = (body.first_name || '').trim()
    const last_name = (body.last_name || '').trim()

    const comp = Number.isFinite(body.comp as any) ? Number(body.comp) : 70
    const role = body.role === 'admin' ? 'admin' : 'agent'
    const is_agency_owner = body.is_agency_owner === true
    const upline_id = body.upline_id ? String(body.upline_id) : null
    const theme = (body.theme || 'blue').trim()

    // Sends Supabase invite email automatically
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (inviteErr || !invited?.user) {
      return NextResponse.json({ error: inviteErr?.message || 'Invite failed' }, { status: 400 })
    }

    const newUserId = invited.user.id

    // Create / update profile row with your custom fields
    const { error: upsertErr } = await supabaseAdmin.from('profiles').upsert(
      {
        id: newUserId,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        role,
        is_agency_owner,
        upline_id,
        comp,
        theme,
        avatar_url: null,
      },
      { onConflict: 'id' }
    )

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
