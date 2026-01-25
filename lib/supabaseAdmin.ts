import { createClient } from '@supabase/supabase-js'

let _admin: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin() {
  if (_admin) return _admin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  // ✅ Only throw when the route actually runs (NOT during build import)
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  if (!service) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

  _admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return _admin
}
