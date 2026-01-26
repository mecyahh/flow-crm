// ✅ REPLACE ENTIRE FILE: /lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function getSupabaseAdmin() {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Important: don't create at import time unless env is present.
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!service) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  cached = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cached
}

// ✅ Backwards compatible export used across existing routes.
//    This is a Proxy that lazily creates the client ONLY when a property is accessed.
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseAdmin() as any
      return client[prop]
    },
  }
) as unknown as SupabaseClient
