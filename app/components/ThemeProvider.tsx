'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

function applyTheme(theme: string) {
  const t = (theme || 'blue').toLowerCase()
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem('flow_theme', t)
  } catch {}
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1) Instant theme from localStorage (no flash)
    const cached = typeof window !== 'undefined' ? localStorage.getItem('flow_theme') : null
    if (cached) applyTheme(cached)

    // 2) Then load real theme from profile
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) return

      const { data: prof } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', uid)
        .single()

      applyTheme(prof?.theme || cached || 'blue')
    })()
  }, [])

  return <>{children}</>
}
