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
  { label: 'Analytics', href: '/analytics' },
  { label: 'Settings', href: '/settings' },
]

function getInitials(name?: string) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  const initials = parts.map((p) => p[0]?.toUpperCase()).join('')
  return initials || 'U'
}

function safeParseJSON<T = any>(v: string | null): T | null {
  if (!v) return null
  try {
    return JSON.parse(v) as T
  } catch {
    return null
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Best-effort user display (won't break if your app stores it differently)
  const user = useMemo(() => {
    if (typeof window === 'undefined') return null as any

    const a = safeParseJSON<any>(localStorage.getItem('flow_user'))
    const b = safeParseJSON<any>(localStorage.getItem('user'))

    // ✅ Better Supabase token discovery (covers sb-*-auth-token keys)
    let tokenRaw: any = safeParseJSON<any>(localStorage.getItem('supabase.auth.token'))
    if (!tokenRaw) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i) || ''
          if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
            tokenRaw = safeParseJSON<any>(localStorage.getItem(k))
            if (tokenRaw) break
          }
        }
      } catch {
        // ignore
      }
    }

    const tokenUser =
      tokenRaw?.currentSession?.user ??
      tokenRaw?.currentSession?.user?.user_metadata ??
      tokenRaw?.user ??
      null

    const u = a ?? b ?? tokenUser ?? null
    const meta = u?.user_metadata ?? u?.metadata ?? u ?? {}

    // ✅ Prefer an actual username field if present
    const username =
      meta?.username ||
      meta?.user_name ||
      meta?.preferred_username ||
      meta?.handle ||
      null

    const name =
      username ||
      meta?.full_name ||
      meta?.name ||
      meta?.display_name ||
      u?.name ||
      u?.email ||
      'User'

    const avatarUrl =
      meta?.avatar_url ||
      meta?.picture ||
      meta?.photoURL ||
      u?.avatar_url ||
      u?.picture ||
      null

    return { name, avatarUrl }
  }, [])

  useEffect(() => {
    // Close mobile drawer on route change
    setOpen(false)
  }, [pathname])

  async function logout() {
    try {
      await supabase.auth.signOut()
    } catch {
      // ignore
    }

    // best-effort cleanup for local user caches
    try {
      localStorage.removeItem('flow_user')
      localStorage.removeItem('user')
      localStorage.removeItem('supabase.auth.token')
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || ''
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          localStorage.removeItem(k)
        }
      }
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
              {/* ✅ Always try to show actual profile picture */}
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
          {/* ✅ Signed in as + actual username */}
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
          {/* ✅ Glowy red logout button */}
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

        {/* ✅ Mobile logout in same “bottom bubble” style */}
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
