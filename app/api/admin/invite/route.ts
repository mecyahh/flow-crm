// ✅ FILE: /app/api/admin/invite/route.ts  (REPLACE ENTIRE FILE)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type InviteBody = {
  email?: string
  first_name?: string
  last_name?: string
  role?: 'agent' | 'admin'
  is_agency_owner?: boolean
  comp?: number
  upline_id?: string | null
  theme?: string
}

export async function POST(req: Request) {
  try {
    // 1) Require auth header
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })

    // 2) Identify caller
    const { data: callerUser, error: callerErr } = await supabaseAdmin.auth.getUser(token)
    if (callerErr || !callerUser?.user?.id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
    const callerId = callerUser.user.id

    // 3) Load caller profile (role gate)
    const { data: callerProf, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, is_agency_owner')
      .eq('id', callerId)
      .single()

    if (profErr || !callerProf) return NextResponse.json({ error: 'Caller profile missing' }, { status: 403 })

    const callerIsAdmin = callerProf.role === 'admin'
    const callerIsOwner = callerProf.is_agency_owner === true
    const canInvite = callerIsAdmin || callerIsOwner
    if (!canInvite) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

    // 4) Parse request
    const body = (await req.json()) as InviteBody

    const email = String(body.email || '').trim().toLowerCase()
    const first_name = String(body.first_name || '').trim()
    const last_name = String(body.last_name || '').trim()

    // Defaults
    let role: 'agent' | 'admin' = (body.role === 'admin' ? 'admin' : 'agent')
    let is_agency_owner = Boolean(body.is_agency_owner || false)

    // Owners are not allowed to create admins/owners (only admins can)
    if (!callerIsAdmin) {
      role = 'agent'
      is_agency_owner = false
    }

    const comp = Number(body.comp ?? 0)
    const upline_id = body.upline_id ? String(body.upline_id) : null
    const theme = String(body.theme || 'blue').trim()

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
    if (!first_name || !last_name) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    if (!Number.isFinite(comp)) return NextResponse.json({ error: 'Comp invalid' }, { status: 400 })

    // 5) Invite user (creates user + emails invite)
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { first_name, last_name },
    })

    if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 })

    const userId = invited?.user?.id
    if (!userId) return NextResponse.json({ error: 'Invite failed: missing user id' }, { status: 500 })

    // 6) Upsert profile (so comp/upline/theme/role stick)
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          first_name,
          last_name,
          role,
          is_agency_owner,
          comp,
          upline_id,
          theme,
        },
        { onConflict: 'id' }
      )

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invite failed' }, { status: 500 })
  }
}
