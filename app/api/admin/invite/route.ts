import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

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

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }
    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First + last name required' }, { status: 400 })
    }

    // 🔐 determine correct redirect (NO localhost)
    const redirectTo = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
      : undefined

    const supabaseAdmin = getSupabaseAdmin()

    // 1️⃣ Create auth user (no password yet)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { first_name, last_name },
      })

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 })
    }

    const userId = created.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'User creation failed' }, { status: 500 })
    }

    // 2️⃣ Send invite email (magic link → LIVE SITE)
    const { error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { first_name, last_name },
      })

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 })
    }

    // 3️⃣ Create / upsert profile so hierarchy + comp stick
    const { error: profErr } = await supabaseAdmin
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

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Invite failed' },
      { status: 500 }
    )
  }
}
