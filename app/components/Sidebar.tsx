'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'My Agency', href: '/my-agency' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Carrier Outline', href: '/carrier-outline' },
  { label: 'Post a Deal', href: '/post-deal' },
  { label: 'Deal House', href: '/deal-house' },
  { label: 'Follow Ups', href: '/follow-ups' },
  { label: 'Debt Management', href: '/debt-management' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Settings', href: '/settings' },
]

function getInitials(name?: string) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const initials = parts.map((p) => p[0]?.toUpperCase()).join('')
  return initials || 'U'
}

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // ✅ Real user display from profiles table
  const [user, setUser] = useState<{ name: string; avatarUrl: string | null }>({
    name: 'User',
    avatarUrl: null,
  })

  useEffect(() => {
    // Close mobile drawer on route change
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    let mounted = true

    async function loadMe() {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr

        const uid = userRes.user?.id
        const email = userRes.user?.email || 'User'
        if (!uid) {
          if (!mounted) return
          setUser({ name: 'User', avatarUrl: null })
          return
        }

        // ✅ Pull from profiles (this is where your first_name + avatar_url are)
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('first_name,last_name,avatar_url,email')
          .eq('id', uid)
          .single()

        if (profErr) throw profErr

        const first = (prof?.first_name || '').trim()
        const last = (prof?.last_name || '').trim()

        // Prefer first name, fall back to full, then email
        const displayName =
          first ||
          [first, last].filter(Boolean).join(' ').trim() ||
          (prof?.email as string) ||
          email ||
          'User'

        if (!mounted) return
        setUser({
          name: displayName,
          avatarUrl: (prof?.avatar_url as string | null) || null,
        })
      } catch {
        // Fallback: at least show email if profile lookup fails
        try {
          const { data } = await supabase.auth.getUser()
          const email = data.user?.email || 'User'
          if (mounted) setUser({ name: email, avatarUrl: null })
        } catch {
          if (mounted) setUser({ name: 'User', avatarUrl: null })
        }
      }
    }

    loadMe()

    // Optional: update on auth changes (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadMe()
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }
    window.location.href = '/login'
  }

  const DesktopNav = (
    <aside
      className="
        hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen md:w-64
        bg-[#0b0f1a]/90 backdrop-blur-xl
        border-r border-white/10
      "
    >
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="group select-none">
            <div className="text-[13px] tracking-[0.22em] text-white/50 uppercase">Flow</div>
            <div className="text-xl font-semibold leading-tight transition-transform duration-200 group-hover:scale-[1.03]">
              Dashboard
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-white/80">{getInitials(user?.name)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs text-white/50">Signed in as</div>
          <div className="mt-0.5 text-sm font-medium truncate">{user?.name ?? 'User'}</div>
        </div>
      </div>

      <div className="px-4 pb-6">
        <nav className="flex flex-col gap-1.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group relative px-4 py-3 rounded-2xl border text-sm transition-all duration-200',
                  'hover:-translate-y-[1px] hover:shadow-[0_10px_35px_-18px_rgba(255,255,255,0.25)]',
                  active ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/[0.06]',
                ].join(' ')}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={[
                      'transition-all duration-200',
                      'group-hover:text-[15px] group-hover:tracking-wide',
                      active ? 'text-white' : 'text-white/90',
                    ].join(' ')}
                  >
                    {item.label}
                  </span>
                </span>
                <span
                  className={[
                    'pointer-events-none absolute inset-x-3 bottom-2 h-px rounded-full opacity-0 transition-opacity duration-200',
                    'bg-gradient-to-r from-transparent via-white/30 to-transparent',
                    active ? 'opacity-100' : 'group-hover:opacity-60',
                  ].join(' ')}
                />
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 pt-0">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <button
            onClick={logout}
            className="
              w-full rounded-2xl px-4 py-3 text-sm font-semibold
              border border-red-400/25
              bg-gradient-to-r from-red-600/25 via-red-500/20 to-red-600/25
              text-red-100
              shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_30px_-18px_rgba(255,0,0,0.55)]
              hover:border-red-300/35 hover:bg-red-500/20
              hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_14px_40px_-22px_rgba(255,0,0,0.75)]
              transition
            "
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  )

  const MobileDrawer = (
    <>
      <button
        onClick={() => setOpen(true)}
        className="
          md:hidden fixed top-4 left-4 z-50
          rounded-2xl border border-white/10
          bg-[#0b0f1a]/85 backdrop-blur-xl
          px-4 py-2 text-sm
          shadow-[0_12px_40px_-24px_rgba(0,0,0,0.9)]
        "
      >
        Menu
      </button>

      <div onClick={() => setOpen(false)} className={`md:hidden fixed inset-0 z-40 ${open ? 'bg-black/60' : 'hidden'}`} />

      <aside
        className={`
          md:hidden fixed top-0 left-0 z-50 h-screen w-80 max-w-[85vw]
          bg-[#0b0f1a]/92 backdrop-blur-xl border-r border-white/10
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="select-none">
              <div className="text-[13px] tracking-[0.22em] text-white/50 uppercase">Flow</div>
              <div className="text-xl font-semibold">Menu</div>
            </div>

            <div className="h-10 w-10 rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-white/80">{getInitials(user?.name)}</span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs text-white/50">Signed in as</div>
            <div className="mt-0.5 text-sm font-medium truncate">{user?.name ?? 'User'}</div>
          </div>
        </div>

        <div className="px-4 pb-6">
          <nav className="flex flex-col gap-1.5">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={[
                    'group px-4 py-3 rounded-2xl border text-sm transition-all duration-200',
                    active ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  <span className="transition-all duration-200 group-hover:text-[15px] group-hover:tracking-wide">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 pt-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <button
              onClick={logout}
              className="
                w-full rounded-2xl px-4 py-3 text-sm font-semibold
                border border-red-400/25
                bg-gradient-to-r from-red-600/25 via-red-500/20 to-red-600/25
                text-red-100
                shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_30px_-18px_rgba(255,0,0,0.55)]
                hover:border-red-300/35 hover:bg-red-500/20
                hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_14px_40px_-22px_rgba(255,0,0,0.75)]
                transition
              "
            >
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  )

  return (
    <>
      {MobileDrawer}
      {DesktopNav}
    </>
  )
}
