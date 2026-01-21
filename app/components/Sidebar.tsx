// ✅ REPLACE ENTIRE FILE: /app/components/Sidebar.tsx
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

type Me = {
  id: string
  name: string
  email: string
  avatarUrl: string
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  // ✅ Profile (big + sync)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const { data: uRes } = await supabase.auth.getUser()
        const u = uRes.user
        if (!u) return

        // Try profiles.avatar_url first (if present), fallback to auth metadata
        let avatarUrl = ''
        let fullName = ''
        let email = u.email || ''

        try {
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('first_name,last_name,email,avatar_url')
            .eq('id', u.id)
            .single()

          if (!error && prof) {
            fullName = `${(prof as any).first_name || ''} ${(prof as any).last_name || ''}`.trim()
            email = String((prof as any).email || email || '')
            avatarUrl = String((prof as any).avatar_url || '')
          }
        } catch {
          // ignore; fallback below
        }

        const meta: any = u.user_metadata || {}
        if (!avatarUrl) avatarUrl = String(meta.avatar_url || meta.picture || meta.photoURL || '')
        if (!fullName) fullName = String(meta.full_name || meta.name || '').trim()

        const name = fullName || (email ? email.split('@')[0] : 'Agent')

        if (!alive) return
        setMe({
          id: u.id,
          name,
          email: email || '',
          avatarUrl,
        })
      } catch {
        // ignore
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const initials = useMemo(() => {
    const n = (me?.name || '').trim()
    if (!n) return 'A'
    const parts = n.split(' ').filter(Boolean)
    const a = parts[0]?.[0] || 'A'
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
    return (a + b).toUpperCase()
  }, [me?.name])

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch {}
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-72 p-6 border-r border-white/10 bg-[#070a12]/92 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-7 flex items-center gap-4">
        {/* ✅ BIG profile icon */}
        <div className="relative h-16 w-16 rounded-full overflow-hidden border border-white/10 bg-white/5">
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.avatarUrl}
              alt="Profile"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-lg font-extrabold text-white/80">
              {initials}
            </div>
          )}

          {/* subtle glow */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -inset-8 rounded-full bg-white/5 blur-2xl" />
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight leading-tight">Flow</div>
          <div className="text-[11px] text-white/55 mt-1 truncate">{me?.name ? me.name : 'Deal tracking'}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-xl px-4 py-3 transition border flex items-center justify-between',
                // ✅ slightly smaller category text
                'text-[13px] font-medium',
                active
                  ? 'bg-white/10 border-white/15'
                  : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10',
              ].join(' ')}
            >
              <span className="text-white/90">{item.label}</span>
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

      {/* Bottom */}
      <div className="absolute bottom-6 left-6 right-6">
        <div className="h-px bg-white/10 mb-4" />

        {/* ✅ Logout: transparent glass + red hover */}
        <button
          onClick={logout}
          className={[
            'w-full rounded-2xl border border-white/10 bg-white/5 transition px-4 py-3 text-[13px] font-semibold text-white/85',
            'hover:bg-red-500/15 hover:border-red-400/25 hover:text-red-200',
          ].join(' ')}
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
