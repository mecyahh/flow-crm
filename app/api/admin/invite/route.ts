// ✅ FILE: /app/api/admin/invite/route.ts  (REPLACE ENTIRE FILE)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const email = String(body.email || '').trim().toLowerCase()
    const first_name = String(body.first_name || '').trim()
    const last_name = String(body.last_name || '').trim()
    const role = String(body.role || 'agent').trim() // agent | admin
    const is_agency_owner = Boolean(body.is_agency_owner || false)
    const comp = Number(body.comp ?? 0)
    const upline_id = body.upline_id ? String(body.upline_id) : null
    const theme = String(body.theme || 'blue').trim()

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
    if (!first_name || !last_name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    // create auth user + send invite email (Supabase handles the email)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { first_name, last_name },
    })

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
    const userId = created.user?.id
    if (!userId) return NextResponse.json({ error: 'User create failed' }, { status: 500 })

    // send invite link (magic link style)
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 })

    // create profile row (so comp/theme/upline stick)
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert(
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

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invite failed' }, { status: 500 })
  }
}
