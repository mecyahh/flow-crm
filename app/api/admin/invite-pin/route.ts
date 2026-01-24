import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function pin6() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || ''
    if (!auth.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const email = String(body?.email || '').trim().toLowerCase()
    const first_name = body?.first_name ?? null
    const last_name = body?.last_name ?? null
    const upline_id = body?.upline_id ?? null
    const comp = typeof body?.comp === 'number' ? body.comp : 70
    const role = body?.role || 'agent'
    const is_agency_owner = !!body?.is_agency_owner
    const theme = body?.theme || 'blue'

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const pin = pin6()

    // ✅ Create auth user with PIN as temp password
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true, // you can change to false if you prefer confirm flow
      user_metadata: { first_name, last_name },
    })
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 })

    const userId = created.user?.id
    if (!userId) return NextResponse.json({ error: 'User create failed' }, { status: 400 })

    // ✅ Update profile fields + must_set_password
    const { error: pErr } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name,
        last_name,
        email,
        upline_id,
        comp,
        role,
        is_agency_owner,
        theme,
        must_set_password: true,
      })
      .eq('id', userId)

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })

    // ✅ Email sending:
    // If you already have an email provider in your existing /api/admin/invite route,
    // wire it here the same way. For now we return the pin so YOU can display it in UI.
    return NextResponse.json({ ok: true, user_id: userId, pin })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invite failed' }, { status: 500 })
  }
}
