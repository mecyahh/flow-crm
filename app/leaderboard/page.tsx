// ✅ REPLACE ENTIRE FILE: /app/leaderboard/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '../components/FlowDatePicker'

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url?: string | null
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

  // ✅ Week selector uses FlowDatePicker (anchor date; week snaps Mon→Sun)
  const [weekAnchor, setWeekAnchor] = useState<string>('') // YYYY-MM-DD

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
          .select('id,first_name,last_name,email,avatar_url')
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

        // default = today
        setWeekAnchor(toISODateLocal(new Date()))

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

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>()
    profiles.forEach((p) => m.set(p.id, p))
    return m
  }, [profiles])

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

  // ✅ Week range snaps to Monday start; always 7 days (Mon→Sun)
  const weekRange = useMemo(() => {
    const anchor = weekAnchor ? new Date(weekAnchor + 'T00:00:00') : new Date()
    const monday = startOfWeekMonday(anchor)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const end = new Date(sunday)
    end.setHours(23, 59, 59, 999)
    return { start: monday, end }
  }, [weekAnchor])

  const weekDays = useMemo(() => {
    const out: { key: string; label: string; isSunday: boolean }[] = []
    const d0 = new Date(weekRange.start)
    for (let i = 0; i < 7; i++) {
      const d = new Date(d0)
      d.setDate(d0.getDate() + i)
      out.push({
        key: toISODateLocal(d),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        isSunday: d.getDay() === 0,
      })
    }
    return out
  }, [weekRange.start])

  const weekDeals = useMemo(() => {
    return parsedDeals.filter((d) => d.dt >= weekRange.start && d.dt <= weekRange.end && !!d.uid)
  }, [parsedDeals, weekRange.start, weekRange.end])

  // ✅ Weekly totals PREMIUM (for reference, not used in "Total" now)
  const weekTotalsPremium = useMemo(() => {
    const totals = new Map<string, number>()
    weekDeals.forEach((d) => {
      if (!d.uid) return
      totals.set(d.uid, (totals.get(d.uid) || 0) + d.premiumNum)
    })
    return totals
  }, [weekDeals])

  // ✅ Weekly totals AP (Annual Premium) — premium * 12
  const weekTotalsAP = useMemo(() => {
    const totals = new Map<string, number>()
    weekDeals.forEach((d) => {
      if (!d.uid) return
      const ap = Number(d.premiumNum || 0) * 12
      totals.set(d.uid, (totals.get(d.uid) || 0) + ap)
    })
    return totals
  }, [weekDeals])

  // Daily AP per user per dateKey (premium * 12)
  const dailyAPByUser = useMemo(() => {
    const map = new Map<string, Map<string, number>>() // uid -> (dateKey -> AP sum)

    weekDeals.forEach((d) => {
      if (!d.uid) return
      if (!map.has(d.uid)) map.set(d.uid, new Map<string, number>())
      const inner = map.get(d.uid)!

      const ap = Number(d.premiumNum || 0) * 12
      inner.set(d.dateKey, (inner.get(d.dateKey) || 0) + ap)
    })

    return map
  }, [weekDeals])

  // ✅ Leaderboard follows the selected week
  // - ranking uses weekly AP
  // - Total column uses weekly AP (fix: was premium before)
  const leaderboard = useMemo(() => {
    const allUids = new Set<string>()
    weekDeals.forEach((d) => d.uid && allUids.add(d.uid))

    const rows = Array.from(allUids.values()).map((uid) => {
      const name = nameById.get(uid) || 'Agent'
      const p = profileById.get(uid)
      const avatar_url = p?.avatar_url || null
      const totalPremium = weekTotalsPremium.get(uid) || 0
      const totalAP = weekTotalsAP.get(uid) || 0
      return { uid, name, avatar_url, totalPremium, totalAP }
    })

    rows.sort((a, b) => b.totalAP - a.totalAP)
    return rows
  }, [weekDeals, nameById, profileById, weekTotalsPremium, weekTotalsAP])

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard

  // ✅ Top summary cards
  const agencySummary = useMemo(() => {
    const productionAP = weekDeals.reduce((s, d) => s + Number(d.premiumNum || 0) * 12, 0)
    const families = weekDeals.length
    const writers = new Set(weekDeals.map((d) => d.uid).filter(Boolean) as string[]).size
    return { productionAP, families, writers }
  }, [weekDeals])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {/* animations (top-3 only) */}
      <style jsx global>{`
        @keyframes flowFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
        @keyframes flowShimmer {
          0% { transform: translateX(-120%); opacity: 0; }
          20% { opacity: 0.55; }
          50% { opacity: 0.35; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes crownPop {
          0% { transform: translateY(0px) rotate(-8deg); }
          50% { transform: translateY(-6px) rotate(8deg); }
          100% { transform: translateY(0px) rotate(-8deg); }
        }
        .podium-anim { animation: flowFloat 3.6s ease-in-out infinite; }
        .podium-glow:hover { box-shadow: 0 0 0 1px rgba(255,255,255,0.10), 0 18px 55px rgba(0,0,0,0.55); }
        .podium-shimmer {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .podium-shimmer::before {
          content: '';
          position: absolute;
          top: -20%;
          left: -60%;
          width: 60%;
          height: 140%;
          transform: skewX(-18deg);
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.18) 50%,
            rgba(255,255,255,0) 100%
          );
          animation: flowShimmer 2.8s ease-in-out infinite;
        }
        .crown-anim { animation: crownPop 1.8s ease-in-out infinite; }
      `}</style>

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-white/60 mt-1">Agency-wide weekly leaderboard + daily AP consistency.</p>
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
          </div>
        )}

        {/* ✅ Top-left week selector (FlowDatePicker — glass UI) */}
        <div className="mb-6 max-w-[320px]">
          <FlowDatePicker value={weekAnchor} onChange={(v) => setWeekAnchor(v || toISODateLocal(new Date()))} placeholder="Select week" />
          <div className="mt-2 text-[11px] text-white/45">
            Week: {toISODateLocal(weekRange.start)} → {toISODateLocal(weekRange.end)} (Mon → Sun)
          </div>
        </div>

        {/* ✅ 3 stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <MiniStat label="Agency Production" value={loading ? '—' : `$${formatMoney(agencySummary.productionAP)}`} />
          <MiniStat label="Families Protected" value={loading ? '—' : String(agencySummary.families)} />
          <MiniStat label="Writing Agents" value={loading ? '—' : String(agencySummary.writers)} />
        </div>

        {/* ✅ TOP 3 PODIUM (animated, faces big on right) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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

                  {weekDays.map((d) => (
                    <th key={d.key} className="text-center px-4 py-3 whitespace-nowrap">
                      {d.label}
                    </th>
                  ))}

                  {/* ✅ Total is now Annual Premium (AP) */}
                  <th className="text-right px-6 py-3 whitespace-nowrap">Total AP</th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  rest.map((r, i) => {
                    const daily = dailyAPByUser.get(r.uid) || new Map<string, number>()
                    return (
                      <tr key={r.uid} className="border-b border-white/10 hover:bg-white/5 transition">
                        <td className="px-6 py-4 font-semibold whitespace-nowrap">{i + 1}</td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                              {r.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs text-white/60">{(r.name || 'A').slice(0, 1).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 truncate">{r.name}</div>
                          </div>
                        </td>

                        {weekDays.map((d) => {
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
                          ${formatMoney(r.totalAP)}
                        </td>
                      </tr>
                    )
                  })}

                {!loading && rest.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-white/60" colSpan={3 + weekDays.length}>
                      No data yet.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td className="px-6 py-6 text-white/60" colSpan={3 + weekDays.length}>
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-white/45">Go Close..</div>
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
  data?: { name: string; avatar_url?: string | null; totalAP: number }
  spotlight?: boolean
}) {
  const rankTone =
    rank === 1
      ? { ring: 'ring-yellow-300/25', badge: 'bg-yellow-400/15 text-yellow-200 border-yellow-300/25' }
      : rank === 2
      ? { ring: 'ring-white/20', badge: 'bg-white/10 text-white/85 border-white/20' } // ✅ silver tone
      : { ring: 'ring-orange-500/20', badge: 'bg-orange-500/10 text-orange-200 border-orange-400/25' } // ✅ bronze tone

  return (
    <div
      className={[
        'relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden',
        'podium-glow podium-anim transition will-change-transform',
        spotlight ? 'md:-translate-y-2 bg-white/10' : '',
      ].join(' ')}
    >
      <div className="podium-shimmer" />

      {spotlight && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-yellow-400/10 blur-3xl" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[360px] h-[360px] rounded-full bg-yellow-300/10 blur-3xl" />
        </div>
      )}

      {/* layout: left = data, right = BIG face */}
      <div className="relative p-6 flex items-stretch gap-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white/60">Rank</div>
          <div className="mt-1 text-3xl font-extrabold">{rank}</div>

          <div className="mt-4 text-xs text-white/60">Agent</div>
          <div className={spotlight ? 'mt-1 text-xl font-extrabold truncate' : 'mt-1 text-lg font-semibold truncate'}>
            {data?.name || '—'}
          </div>

          <div className="mt-4 text-xs text-white/60">Total AP</div>
          <div className={spotlight ? 'mt-1 text-3xl font-extrabold text-green-300' : 'mt-1 text-2xl font-bold text-green-300'}>
            {data ? `$${formatMoney(data.totalAP)}` : '—'}
          </div>
        </div>

        {/* ✅ big face area */}
        <div className="relative w-[120px] md:w-[140px] shrink-0">
          <div className={['absolute inset-0 rounded-2xl overflow-hidden border border-white/10 bg-white/5 ring-1', rankTone.ring].join(' ')}>
            {data?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-extrabold text-white/50">
                {(data?.name || 'A').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          {/* ✅ crown scales over the image for #1 */}
          {rank === 1 && (
            <div className="absolute -top-6 -left-4 crown-anim">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-3xl md:text-4xl">
                👑
              </div>
            </div>
          )}

          {/* subtle rank badge */}
          <div className={['absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-xl border text-[11px] font-bold', rankTone.badge].join(' ')}>
            #{rank}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-6">
      <p className="text-sm text-white/60">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
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

function startOfWeekMonday(d: Date) {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  const day = dt.getDay() // 0..6
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  return dt
}
