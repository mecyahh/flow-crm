'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

function isAuthRoute(pathname: string) {
  if (pathname === '/') return true
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/signup')) return true
  if (pathname.startsWith('/auth')) return true
  if (pathname.startsWith('/forgot')) return true
  if (pathname.startsWith('/reset')) return true
  if (pathname.startsWith('/forgot-password')) return true
  if (pathname.startsWith('/reset-password')) return true
  return false
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideSidebar = isAuthRoute(pathname)

  if (hideSidebar) {
    return (
      <main className="min-h-screen w-full min-w-0 px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    )
  }

  return (
    <div className="min-h-screen w-full min-w-0 flex">
      <Sidebar />
      {/* ✅ Reduced desktop padding so content fits more */}
      <main className="flex-1 w-full min-w-0 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  )
}
