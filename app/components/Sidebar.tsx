'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 p-6 bg-[#070a12] border-r border-white/10">
      <div className="mb-8">
        <div className="text-xl font-semibold tracking-tight">Flow</div>
        <div className="text-xs text-white/50 mt-1">Deal tracking</div>
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
                active
                  ? 'bg-white/10 border-white/15'
                  : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10',
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

      <div className="absolute bottom-6 left-6 right-6 text-xs text-white/40">v1</div>
    </aside>
  )
}
