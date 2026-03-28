import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        is_active: false,
        terminated_at: new Date().toISOString(),
      })
      .eq('id', user_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
