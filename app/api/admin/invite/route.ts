// ✅ REPLACE ENTIRE FILE: /app/api/admin/invite/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const email = String(body.email || '').trim().toLowerCase()
    const first_name = String(body.first_name || '').trim()
    const last_name = String(body.last_name || '').trim()
    const role = String(body.role || 'agent').trim()
    const is_agency_owner = Boolean(body.is_agency_owner || false)
    const comp = Number(body.comp ?? 0)
    const upline_id = body.upline_id ? String(body.upline_id) : null
    const theme = String(body.theme || 'blue').trim()

    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First + last name required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? process.env.VERCEL_URL.startsWith('http')
          ? process.env.VERCEL_URL
          : `https://${process.env.VERCEL_URL}`
        : '')

    const redirectTo = baseUrl ? `${baseUrl}/login` : undefined

    // 1️⃣ Create auth user
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { first_name, last_name },
      })

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

    const userId = created.user?.id
    if (!userId) return NextResponse.json({ error: 'User creation failed' }, { status: 500 })

    // 2️⃣ Invite email
    const { error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { first_name, last_name },
      })

    if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 400 })

    // 3️⃣ Upsert profile
    const payload = {
      id: userId,
      email,
      first_name,
      last_name,
      role,
      is_agency_owner,
      comp,
      upline_id,
      theme,
    }

    // ✅ Supabase TS can be picky here; cast builder only (not whole client)
    const { error: profErr } = await (supabaseAdmin.from('profiles') as any).upsert(payload, {
      onConflict: 'id',
    })

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invite failed' }, { status: 500 })
  }
}
