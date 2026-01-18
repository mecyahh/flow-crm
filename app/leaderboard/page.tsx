'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type DealRow = {
  agent_id: string | null
  premium: number | null
  created_at: string
}

type AgentAgg = {
  agent_id: string
  name: string
  email: string
  byDay: Record<string, number> // yyyy-mm-dd -> premium sum
  total: number
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentAgg[]>([])

  const days = useMemo(() => getLastNDays(7), [])
  const dayKeys = useMemo(() => days.map((d) => toISO(d)), [days])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    setToast(null)

    // Pull deals (premium per day per agent)
    const { data: deals, error: dealErr } = await supabase
      .from('deals')
      .select('agent_id, premium, created_at')
      .order('created_at', { ascending: false })
      .limit(50000)

    if (dealErr) {
      setToast('Could not load deals (RLS)')
      setLoading(false)
      return
    }

    // Pull profiles (agent names)
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .limit(5000)

    if (profErr) {
      setToast('Could not load profiles (RLS)')
      setLoading(false)
      return
    }

    const profMap = new Map<string, Profile>()
    for (const p of (profiles || []) as Profile[]) profMap.set(p.id, p)

    // Aggregate
    const aggMap = new Map<string, AgentAgg>()
    for (const row of (deals || []) as DealRow[]) {
      const agent_id = row.agent_id
      if (!agent_id) continue

      const created = new Date(row.created_at)
      const day = toISO(created)
      if (!dayKeys.includes(day)) continue

      const premium = safeNum(row.premium)

      if (!aggMap.has(agent_id)) {
        const prof = profMap.get(agent_id)
        const name = cleanName(prof?.first_name, prof?.last_name, prof?.email)
        aggMap.set(agent_id, {
          agent_id,
          name,
          email: prof?.email || '',
          byDay: {},
          total: 0,
        })
      }

      const a = aggMap.get(agent_id)!
      a.byDay[day] = (a.byDay[day] || 0) + premium
      a.total += premium
    }

    // Ensure every agent has all day keys
    for (const a of aggMap.values()) {
      for (const k of dayKeys) if (a.byDay[k] === undefined) a.byDay[k] = 0
    }

    const list = Array.from(aggMap.values()).sort((a, b) => b.total - a.total)
    setAgents(list)
    setLoading(false)
  }

  const top3 = useMemo(() => agents.slice(0, 3), [agents])

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnSoft} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-white/60 mt-1">Premium consistency by day.</p>
          </div>

          <button onClick={load} className={btnGlass}>
            Refresh
          </button>
        </div>

        {/* PODIUM */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {top3.map((a, idx) => (
            <div
              key={a.agent_id}
              className={[
                'relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden p-6',
                idx === 0 ? 'shadow-2xl' : '',
              ].join(' ')}
            >
              {/* Spotlight for #1 */}
              {idx === 0 && (
                <>
                  <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[360px] bg-white/10 blur-3xl rounded-full" />
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[420px] h-[260px] bg-blue-500/20 blur-3xl rounded-full" />
                </>
              )}

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">#{idx + 1}</div>
                  <div className="text-xs text-white/60">Podium</div>
                </div>

                <div className="mt-3">
                  <div className={idx === 0 ? 'text-2xl font-extrabold tracking-tight' : 'text-xl font-bold'}>
                    {a.name}
                  </div>

                  <div className={idx === 0 ? 'mt-2 text-3xl font-black tracking-tight' : 'mt-2 text-2xl font-extrabold'}>
                    {money(a.total)}
                  </div>

                  <div className="mt-2 text-xs text-white/55">
                    Total premium (last {dayKeys.length} days)
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* If <3 agents, fill blanks */}
          {top3.length < 3 &&
            Array.from({ length: 3 - top3.length }).map((_, i) => (
              <div
                key={`blank-${i}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50"
              >
                No data
              </div>
            ))}
        </div>

        {/* FULL TABLE */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">Rankings</div>
            <div className="text-xs text-white/60">{agents.length.toLocaleString()} agents</div>
          </div>

          {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}

          {!loading && agents.length === 0 && (
            <div className="px-6 py-10 text-center text-white/60">No premium data in range.</div>
          )}

          {!loading && agents.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-white/55">
                  <tr className="border-b border-white/10">
                    <th className={th}>Rank</th>
                    <th className={th}>Agent</th>

                    {days.map((d) => (
                      <th key={toISO(d)} className={thCenter}>
                        {md(d)}
                      </th>
                    ))}

                    <th className={thRight}>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {agents.map((a, i) => (
                    <tr
                      key={a.agent_id}
                      className={[
                        'border-b border-white/10 hover:bg-white/5 transition',
                        i < 3 ? 'bg-white/[0.03]' : '',
                      ].join(' ')}
                    >
                      <td className={tdStrong}>#{i + 1}</td>
                      <td className={tdStrong}>{a.name}</td>

                      {days.map((d) => {
                        const k = toISO(d)
                        const isSunday = d.getDay() === 0
                        if (isSunday) {
                          return (
                            <td key={k} className={tdCenterMuted}>
                              — —
                            </td>
                          )
                        }

                        const v = safeNum(a.byDay[k])
                        if (v === 0) {
                          return (
                            <td key={k} className={tdCenterRed}>
                              0
                            </td>
                          )
                        }

                        return (
                          <td key={k} className={tdCenter}>
                            {money(v)}
                          </td>
                        )
                      })}

                      <td className={tdRightStrong}>{money(a.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------- helpers ---------------- */

function getLastNDays(n: number) {
  const out: Date[] = []
  const today = startOfDay(new Date())
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push(d)
  }
  return out
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function md(d: Date) {
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${m}/${day}`
}

function safeNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function money(n: number) {
  const v = Number(n) || 0
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function cleanName(first?: string | null, last?: string | null, email?: string | null) {
  const fn = (first || '').trim()
  const ln = (last || '').trim()
  const full = `${fn} ${ln}`.trim()
  if (full) return full
  if (email) return email.split('@')[0]
  return 'Agent'
}

/* ---------------- styles ---------------- */

const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thCenter = 'text-center px-4 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'

const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdRightStrong = 'px-6 py-4 text-right font-extrabold whitespace-nowrap'
const tdCenter = 'px-4 py-4 text-center whitespace-nowrap font-semibold'
const tdCenterMuted = 'px-4 py-4 text-center whitespace-nowrap text-white/40 font-semibold'

const tdCenterRed =
  'px-4 py-4 text-center whitespace-nowrap font-extrabold text-red-300'
