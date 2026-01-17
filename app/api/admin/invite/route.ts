// /app/api/admin/invite/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function supabaseAnonWithAuth(req: Request) {
  const auth = req.headers.get('authorization') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
}

export async function POST(req: Request) {
  const body = await req.json()

  const sb = supabaseAnonWithAuth(req)
  const { data: me } = await sb.auth.getUser()
  const uid = me.user?.id
  if (!uid) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: prof } = await sb.from('profiles').select('role').eq('id', uid).single()
  if (prof?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const email = String(body.email || '').trim().toLowerCase()
  const first_name = String(body.first_name || '').trim()
  const last_name = String(body.last_name || '').trim()
  const upline_id = body.upline_id ? String(body.upline_id) : null
  const comp = Number(body.comp || 70)
  const is_agency_owner = Boolean(body.is_agency_owner || false)
  const theme = String(body.theme || 'blue')
  const role = String(body.role || 'agent')

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/login`

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (error || !data?.user) return NextResponse.json({ error: error?.message || 'Invite failed' }, { status: 400 })

  const newId = data.user.id

  const { error: pErr } = await supabaseAdmin.from('profiles').upsert({
    id: newId,
    email,
    first_name,
    last_name,
    role,
    upline_id,
    comp,
    is_agency_owner,
    theme,
  })

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, id: newId })
}
