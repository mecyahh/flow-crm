import './globals.css'
import Sidebar from './components/Sidebar'

export const metadata = {
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
      {/* ✅ Forced dark (light mode removed completely) */}
      <body className="min-h-screen bg-[#0b0f1a] text-white overflow-x-hidden">
        {/* ✅ Sidebar is global + fixed overlay */}
        <Sidebar />

        {/* ✅ Content stays full width */}
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
