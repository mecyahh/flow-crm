'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Carrier Outline', href: '/carrier-outline' },
  { label: 'Post a Deal', href: '/post-deal' },
  { label: 'Deal House', href: '/deal-house' },
  { label: 'Follow Ups', href: '/follow-ups' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Settings', href: '/settings' },
] as const

type ThemeMode = 'dark' | 'light'

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return

  // Persist + set marker
  localStorage.setItem('flow_theme', mode)
  document.documentElement.dataset.theme = mode

  // Update shared CSS variables (your pages already use var(--bg) / var(--text))
  if (mode === 'light') {
    document.documentElement.style.setProperty('--bg', '#f7f8fb')
    document.documentElement.style.setProperty('--text', '#0b1020')
    document.documentElement.style.setProperty('--panel', 'rgba(255,255,255,0.72)')
    document.documentElement.style.setProperty('--panelSolid', '#ffffff')
    document.documentElement.style.setProperty('--border', 'rgba(0,0,0,0.10)')
    document.documentElement.style.setProperty('--muted', 'rgba(0,0,0,0.55)')
    document.documentElement.style.setProperty('--muted2', 'rgba(0,0,0,0.35)')
  } else {
    document.documentElement.style.setProperty('--bg', '#0b0f1a')
    document.documentElement.style.setProperty('--text', '#ffffff')
    document.documentElement.style.setProperty('--panel', 'rgba(255,255,255,0.05)')
    document.documentElement.style.setProperty('--panelSolid', '#070a12')
    document.documentElement.style.setProperty('--border', 'rgba(255,255,255,0.10)')
    document.documentElement.style.setProperty('--muted', 'rgba(255,255,255,0.55)')
    document.documentElement.style.setProperty('--muted2', 'rgba(255,255,255,0.35)')
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')

  useEffect(() => {
    // Load theme (default dark)
    const saved = (typeof window !== 'undefined' ? (localStorage.getItem('flow_theme') as ThemeMode | null) : null) || 'dark'
    setTheme(saved)
    applyTheme(saved)

    // Load user pic/name (no DB dependency; uses auth metadata safely)
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const u = data.user
        if (!u) return
        const md: any = u.user_metadata || {}
        const pic =
          md.avatar_url ||
          md.picture ||
          md.photo_url ||
          md.image ||
          '' // fallback empty -> initials
        setAvatarUrl(String(pic || ''))

        const name =
          md.full_name ||
          md.name ||
          [md.first_name, md.last_name].filter(Boolean).join(' ') ||
          (u.email ? String(u.email).split('@')[0] : 'Flow User')
        setDisplayName(String(name || 'Flow User'))
      } catch {}
    })()
  }, [])

  const initials = useMemo(() => {
    const n = String(displayName || '').trim()
    if (!n) return 'F'
    const parts = n.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] || 'F'
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
    return (a + b).toUpperCase()
  }, [displayName])

  function toggleTheme() {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch {}
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={[
        'fixed left-0 top-0 h-screen w-64 p-6 border-r',
        // ✅ stop color-blocking: follow app variables/theme
        'bg-[var(--panelSolid)]',
        'border-[var(--border)]',
      ].join(' ')}
    >
      {/* Header w/ profile circle (top-left) */}
      <div className="mb-8 flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-full border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div className="text-xs font-extrabold text-white/80">{initials}</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-tight leading-tight">Flow</div>
          <div className="text-xs mt-1 truncate" style={{ color: 'var(--muted)' }}>
            Deal tracking
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-xl px-4 py-3 text-sm transition border flex items-center justify-between',
                active ? 'bg-white/10 border-white/15' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10',
              ].join(' ')}
            >
              <span>{item.label}</span>
              {active ? (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: 'var(--accent)',
                    boxShadow: '0 0 18px var(--glow)',
                  }}
                />
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="absolute bottom-6 left-6 right-6 space-y-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold flex items-center justify-between"
        >
          <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          <span className="text-white/60">{theme === 'dark' ? '🌙' : '☀️'}</span>
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold flex items-center justify-between"
        >
          <span>Logout</span>
          <span className="text-white/60">↩︎</span>
        </button>

        {/* Compliance / footer */}
        <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--muted2)' }}>
          <span>v1</span>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}
