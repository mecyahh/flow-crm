// /app/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [msg, setMsg] = useState<string>('Loading…')
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    let alive = true

    async function run() {
      try {
        setStatus('loading')
        setMsg('Checking auth…')

        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw new Error(`auth.getUser: ${userErr.message}`)
        if (!userRes.user) throw new Error('Not logged in. Go to /login first.')

        setMsg('Fetching deals count…')

        const { count, error } = await supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })

        if (error) throw new Error(`deals select: ${error.message}`)

        if (!alive) return
        setCount(count || 0)
        setStatus('ready')
        setMsg('OK ✅')
      } catch (e: any) {
        if (!alive) return
        setStatus('error')
        setMsg(e?.message || 'Unknown error')
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />
      <div className="ml-64 px-10 py-10">
        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="text-2xl font-semibold tracking-tight">Dashboard</div>
          <div className="mt-2 text-sm text-white/60">Crash-safe mode</div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Status</div>
            <div className="mt-1 font-semibold">{status.toUpperCase()}</div>
            <div className="mt-2 text-sm text-white/70">{msg}</div>
          </div>

          {status === 'ready' && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Deals in database</div>
              <div className="mt-1 text-3xl font-semibold">{count.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
