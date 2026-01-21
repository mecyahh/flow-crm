import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function HomePage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies }
  )

  const { data } = await supabase.auth.getUser()

  // ✅ Logged in → dashboard
  if (data?.user) {
    redirect('/dashboard')
  }

  // ✅ Logged out → login
  redirect('/login')
}
