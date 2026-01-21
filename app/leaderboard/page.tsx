// ✅ FILE: /app/leaderboard/page.tsx  (REPLACE ENTIRE FILE)
// Restores your original professional layout:
// - Podium stays: #1 centered, #2 left, #3 right (desktop) + stacks 1,2,3 on mobile
// - Weekly calendar columns (M/D) with daily premium per agent
// - Sundays show "--", all other days: bold red 0 if no production
// - Total column is MONTH-TO-DATE premium (green)

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
  id: string
  user_id: string | null
  agent_id: string | null
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

        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id,first_name,last_name,email')
          .limit(10000)
        if (pErr) throw new Error(`profiles: ${pErr.message}`)

        // IMPORTANT: support both schemas:
        // - older: deals.user_id
        // - newer: deals.agent_id (and possibly user_id too)
        const { data: ds, error: dErr } = await supabase
          .from('deals')
          .select('id,user_id,agent_id,created_at,premium')
          .order('created_at', { ascending: false })
          .limit(15000)
        if (dErr) throw new Error(`deals: ${dErr.message}`)

        if (!alive) return
        setProfiles((profs || []) as Profile[])
        setDeals((ds || []) as DealRow[])
        setLoading(false)
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Leaderboard error')
        setLoading(false)
      }
    })()

    return () => {
      alive = false
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

      const uid = (d.user_id || d.agent_id || '').toString()

      return {
        ...d,
        uid,
        dt,
        premiumNum: Number.isFinite(premiumNum) ? premiumNum : 0,
        dateKey: toISODateLocal(dt),
      }
    })
  }, [deals])

  // Monthly totals (for Total column + sorting)
  const monthStart = useMemo(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  }, [])

  const monthDeals = useMemo(() => parsedDeals.filter((d) => d.dt >= monthStart), [parsedDeals, monthStart])

  const monthTotals = useMemo(() => {
    const totals = new Map<string, number>()
    monthDeals.forEach((d) => {
      if (!d.uid) return
      totals.set(d.uid, (totals.get(d.uid) || 0) + d.premiumNum)
    })
    return totals
  }, [monthDeals])

  // Last 7 calendar dates columns (M/D)
  const last7Days = useMemo(() => {
    const out: { key: string; label: string; isSunday: boolean }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      out.push({
        key: toISODateLocal(d),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        isSunday: d.getDay() === 0,
      })
    }
    return out
  }, [])

  // Daily premiums per user per dateKey (local date)
  const dailyPremiumByUser = useMemo(() => {
    const map = new Map<string, Map<string, number>>() // uid -> (dateKey -> sum)
    parsedDeals.forEach((d) => {
      if (!d.uid) return
      if (!map.has(d.uid)) map.set(d.uid, new Map<string, number>())
      const inner = map.get(d.uid)!
      inner.set(d.dateKey, (inner.get(d.dateKey) || 0) + d.premiumNum)
    })
    return map
  }, [parsedDeals])

  const leaderboard = useMemo(() => {
    const rows = Array.from(monthTotals.entries()).map(([uid, total]) => ({
      uid,
      name: nameById.get(uid) || 'Agent',
      total,
    }))
    rows.sort((a, b) => b.total - a.total)
    return rows
  }, [monthTotals, nameById])

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-[var(--text)]/60 mt-1">Agency-wide monthly production + weekly consistency.</p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-4 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>

        {err && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm mb-6">
            <div className="font-semibold text-red-200">Error</div>
            <div className="mt-1 text-red-100/80">{err}</div>
          </div>
        )}

        {/* TOP 3 PODIUM (professional, centered #1) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Mobile stack order: 1,2,3. Desktop order: 2 | 1 | 3 */}
          <div className="order-2 md:order-1">
            <PodiumCard rank={2} data={top3[1]} />
          </div>
          <div className="order-1 md:order-2">
            <PodiumCard rank={1} data={top3[0]} spotlight />
          </div>
          <div className="order-3 md:order-3">
            <PodiumCard rank={3} data={top3[2]} />
          </div>
        </div>

        {/* FULL TABLE */}
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-6 py-4 bg-[var(--panel)] flex items-center justify-between">
            <div className="text-sm font-semibold">All Agents</div>
            <div className="text-xs text-[var(--text)]/60">{loading ? 'Loading…' : `${rest.length} agents`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] text-[var(--text)]/55">
                <tr className="border-b border-[var(--border)]">
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
                    const daily = dailyPremiumByUser.get(r.uid) || new Map<string, number>()
                    return (
                      <tr key={r.uid} className="border-b border-[var(--border)] hover:bg-[var(--panel)] transition">
                        <td className="px-6 py-4 font-semibold whitespace-nowrap">{i + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{r.name}</td>

                        {last7Days.map((d) => {
                          if (d.isSunday) {
                            return (
                              <td key={d.key} className="px-4 py-4 text-center text-[var(--text)]/40 font-semibold whitespace-nowrap">
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
                    <td className="px-6 py-6 text-[var(--text)]/60" colSpan={3 + last7Days.length}>
                      No data yet.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td className="px-6 py-6 text-[var(--text)]/60" colSpan={3 + last7Days.length}>
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-[var(--text)]/45">Sundays show “--”. All other days: 0 = bold red, production = green.</div>
      </div>
    </div>
  )
}

/* ---------- Components ---------- */

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
        'relative rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 overflow-hidden',
        spotlight ? 'md:-translate-y-2 bg-[var(--panel2)]' : '',
      ].join(' ')}
    >
      {spotlight && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-yellow-400/10 blur-3xl" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[360px] h-[360px] rounded-full bg-yellow-300/10 blur-3xl" />
        </div>
      )}

      <div className="relative">
        <div className="text-xs text-[var(--text)]/60">Rank</div>
        <div className="mt-1 text-3xl font-extrabold">{rank}</div>

        <div className="mt-4 text-xs text-[var(--text)]/60">Agent</div>
        <div className={spotlight ? 'mt-1 text-xl font-extrabold' : 'mt-1 text-lg font-semibold'}>
          {data?.name || '—'}
        </div>

        <div className="mt-4 text-xs text-[var(--text)]/60">Premium</div>
        <div
          className={
            spotlight ? 'mt-1 text-3xl font-extrabold text-green-300' : 'mt-1 text-2xl font-bold text-green-300'
          }
        >
          {data ? `$${formatMoney(data.total)}` : '—'}
        </div>
      </div>
    </div>
  )
}

/* ---------- Helpers ---------- */

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
