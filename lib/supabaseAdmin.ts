// ✅ REPLACE ENTIRE FILE: /lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdmin: SupabaseClient | undefined
}

export function getSupabaseAdmin(): SupabaseClient {
  // ✅ Reuse across hot reloads / serverless invocations
  if (globalThis.__supabaseAdmin) return globalThis.__supabaseAdmin

  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''

  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''

  if (!url) throw new Error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)')
  if (!service) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  globalThis.__supabaseAdmin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return globalThis.__supabaseAdmin
}

// ✅ Backwards compatible export used across existing routes.
export const supabaseAdmin: SupabaseClient = getSupabaseAdmin()
