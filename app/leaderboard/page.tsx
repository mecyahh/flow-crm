// /app/leaderboard/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  agent_id: string
  total_deals: number
  total_premium: number
  total_coverage: number
}

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  theme?: string | null
}

type DisplayRow = Row & {
  rank: number
  name: string
  initials: string
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    // Aggregate by agent_id only
    const { data: dealsAgg, error: dealsErr } = await supabase
      .from('deals')
      .select('agent_id, premium, coverage')
      .not('agent_id', 'is', null)
      .limit(5000)

    if (dealsErr) {
      setToast('Could not load deals')
      setLoading(false)
      return
    }

    const agg = new Map<string, Row>()

    for (const d of dealsAgg || []) {
      const agent_id = (d as any).agent_id as string
      if (!agent_id) continue

      const premium = Number((d as any).premium || 0)
      const coverage = Number((d as any).coverage || 0)

      const cur = agg.get(agent_id) || {
        agent_id,
        total_deals: 0,
        total_premium: 0,
        total_coverage: 0,
      }

      cur.total_deals += 1
      cur.total_premium += Number.isFinite(premium) ? premium : 0
      cur.total_coverage += Number.isFinite(coverage) ? coverage : 0

      agg.set(agent_id, cur)
    }

    const leaderboard = Array.from(agg.values()).sort((a, b) => {
      // primary: deals, secondary: premium
      if (b.total_deals !== a.total_deals) return b.total_deals - a.total_deals
      return b.total_premium - a.total_premium
    })

    setRows(leaderboard)

    const agentIds = leaderboard.map((r) => r.agent_id)
    if (agentIds.length === 0) {
      setProfiles({})
      setLoading(false)
      return
    }

    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, theme')
      .in('id', agentIds)

    if (profErr) {
      setToast('Could not load agent profiles')
      setLoading(false)
      return
    }

    const map: Record<string, Profile> = {}
    for (const p of profs || []) map[(p as any).id] = p as any
    setProfiles(map)

    setLoading(false)
  }

  const display: DisplayRow[] = useMemo(() => {
    return rows.map((r, idx) => {
      const p = profiles[r.agent_id]
      const first = (p?.first_name || '').trim()
      const last = (p?.last_name || '').trim()

      // ✅ Prefer name ALWAYS. Only fallback to email if both empty.
      const name =
        (first || last) ? `${first} ${last}`.trim() :
        (p?.email || 'Agent')

      const initials = getInitials(first, last, p?.email || '')

      return { ...r, rank: idx + 1, name, initials }
    })
  }, [rows, profiles])

  const top3 = display.slice(0, 3)
  const rest = display.slice(3)

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                onClick={() => setToast(null)}
              >
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
            <p className="text-sm text-white/60 mt-1">Top performers — spotlight on #1.</p>
          </div>

          <button
            onClick={load}
            className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="glass rounded-2xl border border-white/10 p-10 text-center text-white/60">
            Loading…
          </div>
        )}

        {!loading && display.length === 0 && (
          <div className="glass rounded-2xl border border-white/10 p-10 text-center text-white/60">
            No agent deals yet.
          </div>
        )}

        {!loading && display.length > 0 && (
          <>
            {/* PODIUM */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* #2 */}
              <PodiumCard
                spot={2}
                row={top3[1]}
                tone="silver"
              />

              {/* #1 with spotlight */}
              <PodiumCard
                spot={1}
                row={top3[0]}
                tone="gold"
                spotlight
              />

              {/* #3 */}
              <PodiumCard
                spot={3}
                row={top3[2]}
                tone="bronze"
              />
            </div>

            {/* REST TABLE */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
                <div className="text-sm font-semibold">All Agents</div>
                <div className="text-xs text-white/60">{display.length} agents</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-white/55">
                    <tr className="border-b border-white/10">
                      <th className="text-left px-6 py-3">Rank</th>
                      <th className="text-left px-6 py-3">Agent</th>
                      <th className="text-left px-6 py-3">Deals</th>
                      <th className="text-left px-6 py-3">Total Premium</th>
                      <th className="text-left px-6 py-3">Total Coverage</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rest.map((r) => (
                      <tr key={r.agent_id} className="border-b border-white/10 hover:bg-white/5 transition">
                        <td className="px-6 py-4 font-semibold">{r.rank}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-xs font-semibold">
                              {r.initials}
                            </div>
                            <div>
                              <div className="font-semibold">{r.name}</div>
                              <div className="text-xs text-white/50">Agent</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white/80">{r.total_deals}</td>
                        <td className="px-6 py-4 text-white/80">${fmtMoney(r.total_premium)}</td>
                        <td className="px-6 py-4 text-white/80">${fmtMoney(r.total_coverage)}</td>
                      </tr>
                    ))}

                    {rest.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-white/60">
                          Only 3 agents so far — keep pushing.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- components ---------------- */

function PodiumCard({
  spot,
  row,
  tone,
  spotlight,
}: {
  spot: 1 | 2 | 3
  row?: DisplayRow
  tone: 'gold' | 'silver' | 'bronze'
  spotlight?: boolean
}) {
  const label = spot === 1 ? 'MVP' : spot === 2 ? 'Runner Up' : 'Top 3'
  const ring =
    tone === 'gold'
      ? 'border-yellow-300/25'
      : tone === 'silver'
      ? 'border-white/18'
      : 'border-orange-300/20'

  const badge =
    tone === 'gold'
      ? 'bg-yellow-500/15 border-yellow-300/30 text-yellow-200'
      : tone === 'silver'
      ? 'bg-white/10 border-white/15 text-white/80'
      : 'bg-orange-500/12 border-orange-300/25 text-orange-200'

  return (
    <div className="relative">
      {spotlight && (
        <>
          {/* spotlight beam */}
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[320px] h-[220px] rounded-full blur-3xl bg-white/10" />
          <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 w-[220px] h-[160px] rounded-full blur-2xl bg-yellow-400/10" />
        </>
      )}

      <div className={`glass rounded-2xl border ${ring} p-6 overflow-hidden relative`}>
        {/* pedestal glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-transparent opacity-70" />

        <div className="flex items-start justify-between">
          <div className={`text-[11px] px-3 py-1.5 rounded-2xl border ${badge} font-semibold`}>
            #{spot} • {label}
          </div>

          <div className="text-xs text-white/55">Flow</div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className={`h-14 w-14 rounded-2xl border ${ring} bg-white/5 flex items-center justify-center text-lg font-extrabold`}>
            {row?.initials || '—'}
          </div>

          <div>
            <div className="text-lg font-semibold leading-tight">{row?.name || '—'}</div>
            <div className="text-xs text-white/55 mt-1">Agent</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Deals" value={row ? String(row.total_deals) : '—'} />
          <Stat label="Premium" value={row ? `$${fmtMoney(row.total_premium)}` : '—'} />
          <Stat label="Coverage" value={row ? `$${fmtMoney(row.total_coverage)}` : '—'} />
        </div>

        {spotlight && (
          <div className="mt-5 rounded-2xl border border-yellow-300/25 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-100">
            Spotlight: #1 is dominating — keep the pressure on.
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[10px] text-white/55">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  )
}

/* ---------------- helpers ---------------- */

function fmtMoney(n: any) {
  const num = Number(n)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function getInitials(first: string, last: string, email: string) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) {
    return `${(f[0] || '').toUpperCase()}${(l[0] || '').toUpperCase()}`.trim() || 'A'
  }
  const u = (email || '').split('@')[0] || ''
  return (u.slice(0, 2).toUpperCase() || 'AG').trim()
}
