'use client'

export const dynamic = 'force-dynamic'

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
  id: string
  user_id: string
  created_at: string
  premium: any
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])

  useEffect(() => {
    let alive = true

    // hard timeout to stop “signal aborted” hanging
    const timeout = setTimeout(() => {
      if (!alive) return
      setErr((e) => e || 'Request timed out (RLS or network).')
      setLoading(false)
    }, 12000)

    ;(async () => {
      try {
        setErr(null)
        setLoading(true)

        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw new Error(`auth.getUser: ${userErr.message}`)
        if (!userRes.user) {
          window.location.href = '/login'
          return
        }

        // NOTE:
        // Everyone can view agency leaderboard => requires RLS SELECT on profiles + deals for auth users.
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id,first_name,last_name,email')
          .limit(10000)
        if (pErr) throw new Error(`profiles: ${pErr.message}`)

        const { data: ds, error: dErr } = await supabase
          .from('deals')
          .select('id,user_id,created_at,premium')
          .order('created_at', { ascending: false })
          .limit(8000)
        if (dErr) throw new Error(`deals: ${dErr.message}`)

        if (!alive) return
        setProfiles((profs || []) as Profile[])
        setDeals((ds || []) as DealRow[])
        setLoading(false)
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Leaderboard error')
        setLoading(false)
      } finally {
        clearTimeout(timeout)
      }
    })()

    return () => {
      alive = false
      clearTimeout(timeout)
    }
  }, [])

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    profiles.forEach((p) => {
      const n = `${p.first_name || ''} ${p.last_name || ''}`.trim()
      m.set(p.id, n || p.email || 'Agent')
    })
    return m
  }, [profiles])

  const parsedDeals = useMemo(() => {
    return (deals || []).map((d) => {
      const dt = d.created_at ? new Date(d.created_at) : new Date()
      const premiumNum =
        typeof d.premium === 'number'
          ? d.premium
          : typeof d.premium === 'string'
          ? Number(d.premium.replace(/[^0-9.]/g, ''))
          : Number(d.premium || 0)

      return {
        ...d,
        dt,
        premiumNum: Number.isFinite(premiumNum) ? premiumNum : 0,
        dateKey: toISODateLocal(dt),
      }
    })
  }, [deals])

  // monthly totals
  const monthStart = useMemo(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  }, [])

  const monthDeals = useMemo(() => parsedDeals.filter((d) => d.dt >= monthStart), [parsedDeals, monthStart])

  const monthTotals = useMemo(() => {
    const totals = new Map<string, number>()
    monthDeals.forEach((d) => totals.set(d.user_id, (totals.get(d.user_id) || 0) + d.premiumNum))
    return totals
  }, [monthDeals])

  // last 7 days columns
  const last7Days = useMemo(() => {
    const out: { date: Date; key: string; label: string; isSunday: boolean }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      out.push({
        date: d,
        key: toISODateLocal(d),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        isSunday: d.getDay() === 0,
      })
    }
    return out
  }, [])

  const dailyPremiumByUser = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    parsedDeals.forEach((d) => {
      const u = d.user_id
      const dk = d.dateKey
      if (!map.has(u)) map.set(u, new Map<string, number>())
      const inner = map.get(u)!
      inner.set(dk, (inner.get(dk) || 0) + d.premiumNum)
    })
    return map
  }, [parsedDeals])

  const leaderboard = useMemo(() => {
    const rows = Array.from(monthTotals.entries()).map(([user_id, total]) => ({
      user_id,
      name: nameById.get(user_id) || 'Agent',
      total,
    }))
    rows.sort((a, b) => b.total - a.total)
    return rows
  }, [monthTotals, nameById])

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-white/60 mt-1">Agency-wide monthly production + weekly consistency.</p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>

        {err && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm mb-6">
            <div className="font-semibold text-red-200">Error</div>
            <div className="mt-1 text-red-100/80">{err}</div>
            <div className="mt-2 text-[11px] text-red-100/70">
              If your friend sees this: it’s almost always <b>RLS SELECT</b> blocking profiles/deals.
            </div>
          </div>
        )}

        {/* TOP 3 PODIUM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <PodiumCard rank={2} data={top3[1]} />
          <PodiumCard rank={1} data={top3[0]} spotlight />
          <PodiumCard rank={3} data={top3[2]} />
        </div>

        {/* TABLE */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">All Agents</div>
            <div className="text-xs text-white/60">{loading ? 'Loading…' : `${rest.length} agents`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-white/55">
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-3 whitespace-nowrap">Rank</th>
                  <th className="text-left px-6 py-3 whitespace-nowrap">Agent</th>

                  {last7Days.map((d) => (
                    <th key={d.key} className="text-center px-4 py-3 whitespace-nowrap">
                      {d.label}
                    </th>
                  ))}

                  <th className="text-right px-6 py-3 whitespace-nowrap">Total</th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  rest.map((r, i) => {
                    const daily = dailyPremiumByUser.get(r.user_id) || new Map<string, number>()
                    return (
                      <tr key={r.user_id} className="border-b border-white/10 hover:bg-white/5 transition">
                        <td className="px-6 py-4 font-semibold whitespace-nowrap">{i + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{r.name}</td>

                        {last7Days.map((d) => {
                          if (d.isSunday) {
                            return (
                              <td key={d.key} className="px-4 py-4 text-center text-white/40 font-semibold whitespace-nowrap">
                                --
                              </td>
                            )
                          }
                          const v = daily.get(d.key) || 0
                          if (v <= 0) {
                            return (
                              <td key={d.key} className="px-4 py-4 text-center font-extrabold text-red-300 whitespace-nowrap">
                                0
                              </td>
                            )
                          }
                          return (
                            <td key={d.key} className="px-4 py-4 text-center font-semibold text-green-300 whitespace-nowrap">
                              ${formatMoney(v)}
                            </td>
                          )
                        })}

                        <td className="px-6 py-4 text-right font-semibold text-green-300 whitespace-nowrap">
                          ${formatMoney(r.total)}
                        </td>
                      </tr>
                    )
                  })}

                {!loading && rest.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-white/60" colSpan={3 + last7Days.length}>
                      No data yet.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td className="px-6 py-6 text-white/60" colSpan={3 + last7Days.length}>
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-white/45">Sundays show “--”. All other days: 0 = bold red, production = green.</div>
      </div>
    </div>
  )
}

function PodiumCard({
  rank,
  data,
  spotlight,
}: {
  rank: 1 | 2 | 3
  data?: { name: string; total: number }
  spotlight?: boolean
}) {
  return (
    <div
      className={[
        'relative rounded-2xl border border-white/10 bg-white/5 p-6 overflow-hidden',
        spotlight ? 'md:-translate-y-2 bg-white/10' : '',
      ].join(' ')}
    >
      {spotlight && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-yellow-400/10 blur-3xl" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[360px] h-[360px] rounded-full bg-yellow-300/10 blur-3xl" />
        </div>
      )}

      <div className="relative">
        <div className="text-xs text-white/60">Rank</div>
        <div className="mt-1 text-3xl font-extrabold">{rank}</div>

        <div className="mt-4 text-xs text-white/60">Agent</div>
        <div className={spotlight ? 'mt-1 text-xl font-extrabold' : 'mt-1 text-lg font-semibold'}>
          {data?.name || '—'}
        </div>

        <div className="mt-4 text-xs text-white/60">Premium</div>
        <div className={spotlight ? 'mt-1 text-3xl font-extrabold text-green-300' : 'mt-1 text-2xl font-bold text-green-300'}>
          {data ? `$${formatMoney(data.total)}` : '—'}
        </div>
      </div>
    </div>
  )
}

function formatMoney(n: number) {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function toISODateLocal(d: Date) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
