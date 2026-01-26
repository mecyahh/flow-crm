import './globals.css'
import Sidebar from './components/Sidebar'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Flow',
  description: 'Deal tracking',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f1a] text-white">
        <div className="flex min-h-screen">

          {/* Sidebar fixed width */}
          <div className="hidden md:block w-72 shrink-0">
            <Sidebar />
          </div>

          {/* Mobile overlay sidebar */}
          <div className="md:hidden">
            <Sidebar />
          </div>

          {/* Main content */}
          <main className="flex-1 overflow-x-hidden p-6">
            {children}
          </main>

        </div>
      </body>
    </html>
  )
}
