'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type DealRow = {
  id: string
  agent_id: string
  full_name: string | null
  premium: number | null
  coverage: number | null
  company: string | null
  created_at: string
}

type Agent = {
  agent_id: string
  name: string
  deals: number
  premium: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DealRow[]>([])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('deals')
      .select('id, agent_id, full_name, premium, coverage, company, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (data) setRows(data as DealRow[])
    setLoading(false)
  }

  const agents = useMemo(() => computeAgents(rows), [rows])

  const teamTotalPremium = useMemo(() => sumPremium(rows), [rows])
  const writingAgents = agents.length
  const topCarrier = useMemo(() => computeTopCarrier(rows), [rows])

  const todayCount = useMemo(() => countSince(rows, startOfToday()), [rows])
  const weekCount = useMemo(() => countSince(rows, startOfWeek()), [rows])
  const monthCount = useMemo(() => countSince(rows, startOfMonth()), [rows])

  // Donut goals (editable later via admin settings)
  const weeklyGoalDeals = 30
  const monthlyGoalDeals = 120

  const weeklyProgress = clamp01(weekCount / weeklyGoalDeals)
  const monthlyProgress = clamp01(monthCount / monthlyGoalDeals)

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      <div className="ml-64 px-10 py-10">
        {/* Header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">Live overview of production.</p>
          </div>

          <button
            onClick={() => load()}
            className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
          >
            Refresh
          </button>
        </div>

        {/* Top KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Stat label="Team Total Premium" value={`$${money(teamTotalPremium)}`} />
          <Stat label="Writing Agents" value={`${writingAgents}`} />
          <Stat label="Top Carrier" value={topCarrier || (loading ? '—' : 'No data')} />
        </div>

        {/* Main grid: left content + right leaderboard preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-8 space-y-6">
            {/* Deal velocity (today/week/month) */}
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Active Production</div>
                  <div className="text-xs text-white/60 mt-1">Deals submitted</div>
                </div>
                <div className="text-xs text-white/50">{loading ? 'Loading…' : 'Live'}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MiniStat label="Today" value={loading ? '—' : `${todayCount}`} />
                <MiniStat label="This Week" value={loading ? '—' : `${weekCount}`} />
                <MiniStat label="This Month" value={loading ? '—' : `${monthCount}`} />
              </div>
            </div>

            {/* Goals + Donuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-semibold">Weekly Goal</div>
                    <div className="text-xs text-white/60 mt-1">
                      {weekCount}/{weeklyGoalDeals} deals
                    </div>
                  </div>
                  <div className="text-xs text-white/50">Auto</div>
                </div>
                <Donut progress={weeklyProgress} />
              </div>

              <div className="glass rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-semibold">Monthly Goal</div>
                    <div className="text-xs text-white/60 mt-1">
                      {monthCount}/{monthlyGoalDeals} deals
                    </div>
                  </div>
                  <div className="text-xs text-white/50">Auto</div>
                </div>
                <Donut progress={monthlyProgress} />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-4">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold">Leaderboard Preview</div>
                <a href="/leaderboard" className="text-xs text-blue-400 hover:underline">
                  View full →
                </a>
              </div>

              {loading && (
                <div className="text-sm text-white/60 py-10 text-center">Loading…</div>
              )}

              {!loading && agents.length === 0 && (
                <div className="text-sm text-white/60 py-10 text-center">No data yet.</div>
              )}

              {!loading &&
                agents.slice(0, 8).map((a, idx) => (
                  <div
                    key={a.agent_id}
                    className="flex items-center justify-between py-3 border-t border-white/10 first:border-t-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-xs font-semibold">
                        {idx + 1}
                      </div>
                      <div className="font-medium truncate max-w-[160px]">{a.name}</div>
                    </div>
                    <div className="font-semibold">${money(a.premium)}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- UI components ---------- */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-6 rounded-2xl border border-white/10">
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] text-white/55">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function Donut({ progress }: { progress: number }) {
  const size = 160
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - progress)

  return (
    <div className="flex items-center justify-center py-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.10)"
            strokeWidth={stroke}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(59,130,246,0.95)"
            strokeWidth={stroke}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-semibold">{Math.round(progress * 100)}%</div>
            <div className="text-xs text-white/60 mt-1">Complete</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- data helpers ---------- */

function computeAgents(rows: DealRow[]) {
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

function computeTopCarrier(rows: DealRow[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const c = (r.company || '').trim()
    if (!c) continue
    map.set(c, (map.get(c) || 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [k, v] of map.entries()) {
    if (v > bestCount) {
      best = k
      bestCount = v
    }
  }
  return best
}

function sumPremium(rows: DealRow[]) {
  return rows.reduce((a, r) => a + Number(r.premium || 0), 0)
}

function countSince(rows: DealRow[], since: Date) {
  const t = since.getTime()
  return rows.filter((r) => new Date(r.created_at).getTime() >= t).length
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
