'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  id: string
  agent_id: string
  full_name: string | null
  premium: number | null
  created_at: string
}

type Agent = {
  agent_id: string
  name: string
  deals: number
  premium: number
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const chimeRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    load()
  }, [])

  // Poll + announce when #1 changes
  useEffect(() => {
    const id = setInterval(async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('agent_id, full_name, premium')
        .order('created_at', { ascending: false })
        .limit(5000)

      if (error || !data) return

      const top = computeAgents(data as any[])[0]
      if (!top?.agent_id) return

      const key = 'flow_leader_top1'
      const prev = localStorage.getItem(key)

      // initialize silently once
      if (!prev) {
        localStorage.setItem(key, top.agent_id)
        return
      }

      if (prev !== top.agent_id) {
        localStorage.setItem(key, top.agent_id)

        const msg = `🏆 New #1: ${top.name}`
        setToast(msg)
        playChime()
        notify(msg)

        // refresh list in UI
        setRows((prevRows) => prevRows) // no-op, then reload
        await load()
      }
    }, 20000)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select('id, agent_id, full_name, premium, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (!error && data) setRows(data as Row[])
    setLoading(false)
  }

  function playChime() {
    try {
      if (!chimeRef.current) chimeRef.current = new Audio('/chime.mp3')
      chimeRef.current.currentTime = 0
      chimeRef.current.play().catch(() => {})
    } catch {}
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') return
    await Notification.requestPermission()
  }

  function notify(message: string) {
    try {
      if (!('Notification' in window)) return
      if (Notification.permission !== 'granted') return
      new Notification('Flow Leaderboard', { body: message })
    } catch {}
  }

  const agents = useMemo(() => computeAgents(rows), [rows])
  const top1 = agents[0]
  const top2 = agents[1]
  const top3 = agents[2]
  const rest = agents.slice(3)

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {/* Toast banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="text-xs text-white/60 mt-1">
              Leaderboard updated live.
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                onClick={() => setToast(null)}
              >
                Dismiss
              </button>
              <button
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 transition px-3 py-2 text-xs font-semibold"
                onClick={() => {
                  setToast(null)
                  window.location.reload()
                }}
              >
                View
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-white/60 mt-1">
              Top producers — updated live.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={enableNotifications}
              className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
              title="Enable browser notifications for #1 changes"
            >
              Enable Alerts
            </button>
            <button
              onClick={() => window.location.reload()}
              className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Top 3 podium */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          {/* #2 */}
          <div className="lg:col-span-4">
            <PodiumCard
              rank={2}
              label="🥈 Runner Up"
              agent={top2}
              loading={loading}
              accent="silver"
            />
          </div>

          {/* #1 */}
          <div className="lg:col-span-4">
            <PodiumCard
              rank={1}
              label="🏆 CHAMPION"
              agent={top1}
              loading={loading}
              accent="gold"
              featured
            />
          </div>

          {/* #3 */}
          <div className="lg:col-span-4">
            <PodiumCard
              rank={3}
              label="🥉 Top 3"
              agent={top3}
              loading={loading}
              accent="bronze"
            />
          </div>
        </div>

        {/* Full list */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-5 px-6 py-3 text-xs text-white/60 bg-white/5">
            <div>#</div>
            <div className="col-span-2">Agent</div>
            <div>Deals</div>
            <div>Total Premium</div>
          </div>

          {loading && (
            <div className="px-6 py-10 text-center text-white/60">Loading…</div>
          )}

          {!loading && agents.length === 0 && (
            <div className="px-6 py-10 text-center text-white/60">No data yet.</div>
          )}

          {!loading &&
            rest.map((a, idx) => (
              <div
                key={a.agent_id}
                className="grid grid-cols-5 px-6 py-4 border-t border-white/10 hover:bg-white/5 transition"
              >
                <div className="font-semibold">{idx + 4}</div>
                <div className="col-span-2 font-medium">{a.name}</div>
                <div>{a.deals}</div>
                <div className="font-semibold">${money(a.premium)}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function computeAgents(rows: Array<any>) {
  const map = new Map<string, Agent>()
  for (const r of rows) {
    const id = r.agent_id
    if (!id) continue
    if (!map.has(id)) {
      map.set(id, {
        agent_id: id,
        name: (r.full_name || 'Agent').trim(),
        deals: 0,
        premium: 0,
      })
    }
    const a = map.get(id)!
    a.deals += 1
    a.premium += Number(r.premium || 0)
  }
  return Array.from(map.values()).sort((a, b) => b.premium - a.premium)
}

function PodiumCard({
  rank,
  label,
  agent,
  loading,
  featured,
  accent,
}: {
  rank: 1 | 2 | 3
  label: string
  agent?: { name: string; premium: number; deals: number }
  loading: boolean
  featured?: boolean
  accent: 'gold' | 'silver' | 'bronze'
}) {
  const accentStyles =
    accent === 'gold'
      ? 'from-yellow-500/25 via-blue-500/10 to-transparent border-yellow-500/25'
      : accent === 'silver'
      ? 'from-white/20 via-blue-500/10 to-transparent border-white/15'
      : 'from-orange-500/20 via-blue-500/10 to-transparent border-orange-500/20'

  const ring =
    accent === 'gold'
      ? 'ring-1 ring-yellow-400/25'
      : accent === 'silver'
      ? 'ring-1 ring-white/15'
      : 'ring-1 ring-orange-400/20'

  const height = featured ? 'min-h-[190px]' : 'min-h-[170px]'
  const titleSize = featured ? 'text-3xl' : 'text-2xl'

  return (
    <div
      className={[
        'relative overflow-hidden rounded-2xl border bg-white/5 backdrop-blur-xl',
        ring,
        height,
      ].join(' ')}
    >
      <div className={['pointer-events-none absolute inset-0 bg-gradient-to-br', accentStyles].join(' ')} />
      <div className="pointer-events-none absolute -top-10 left-10 h-40 w-40 rotate-12 rounded-full bg-white/10 blur-2xl" />

      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-white/60">{label}</div>
            <div className={`mt-2 font-semibold tracking-tight ${titleSize}`}>
              {loading ? 'Loading…' : agent?.name || '—'}
            </div>
          </div>

          <div
            className={[
              'flex items-center justify-center rounded-2xl px-3 py-2 text-xs font-semibold border',
              accent === 'gold'
                ? 'border-yellow-400/25 bg-yellow-500/10'
                : accent === 'silver'
                ? 'border-white/15 bg-white/5'
                : 'border-orange-400/20 bg-orange-500/10',
            ].join(' ')}
          >
            #{rank}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-[11px] text-white/55">Deals</div>
            <div className="mt-1 text-lg font-semibold">
              {loading ? '—' : agent?.deals ?? 0}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-[11px] text-white/55">Total Premium</div>
            <div className="mt-1 text-lg font-semibold">
              {loading ? '—' : `$${money(agent?.premium ?? 0)}`}
            </div>
          </div>
        </div>

        {featured && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
            <span className="text-white/50 mr-2">Energy:</span>
            #1 spot claimed. Keep the pace.
          </div>
        )}
      </div>
    </div>
  )
}

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
