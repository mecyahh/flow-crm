export const dynamic = 'force-dynamic'

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type DealRow = {
  id: string
  created_at: string
  agent_id: string | null
  premium: number | null
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfDayISO(d: Date) {
  const dd = new Date(d)
  dd.setHours(0, 0, 0, 0)
  return dd.toISOString()
}
function endOfDayISO(d: Date) {
  const dd = new Date(d)
  dd.setHours(23, 59, 59, 999)
  return dd.toISOString()
}
function startOfWeekISO(d: Date) {
  const dd = new Date(d)
  const day = (dd.getDay() + 6) % 7 // Mon=0
  dd.setDate(dd.getDate() - day)
  dd.setHours(0, 0, 0, 0)
  return dd.toISOString()
}
function startOfMonthISO(d: Date) {
  const dd = new Date(d.getFullYear(), d.getMonth(), 1)
  dd.setHours(0, 0, 0, 0)
  return dd.toISOString()
}

function hourLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function nameFromProfile(p?: Profile | null) {
  if (!p) return ''
  const n = `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim()
  return n || (p.email || '')
}

/* ---------- SUPER LIGHT DONUT (no chart.js) ---------- */
function Donut({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0
  const deg = Math.round(pct * 360)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-xs text-white/60">{Math.round(pct * 100)}%</div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="h-14 w-14 rounded-full"
          style={{
            background: `conic-gradient(rgba(59,130,246,0.95) ${deg}deg, rgba(255,255,255,0.10) 0deg)`,
          }}
        />
        <div className="text-lg font-extrabold">{money(value)}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [me, setMe] = useState<Profile | null>(null)
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map())

  // date picker for the TOP 3 cards (specific day)
  const [dayPick, setDayPick] = useState<string>(toISODate(new Date()))

  // data
  const [todayProd, setTodayProd] = useState(0)
  const [weekProd, setWeekProd] = useState(0)
  const [monthProd, setMonthProd] = useState(0)

  const [writingAgents, setWritingAgents] = useState(0)
  const [topCard, setTopCard] = useState<{ label: string; value: number }>({ label: '—', value: 0 })

  const [donutA, setDonutA] = useState(0) // Production
  const [donutB, setDonutB] = useState(0) // Writing Agents (as proxy)
  const [donutC, setDonutC] = useState(0) // Deals submitted

  const [top5, setTop5] = useState<Array<{ agent_id: string; name: string; total: number }>>([])

  const [activity, setActivity] = useState<Array<{ id: string; created_at: string; agent: string; premium: number }>>([])

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!me) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, dayPick])

  async function boot() {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) {
      setLoading(false)
      return
    }

    const { data: prof } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('id', uid).single()
    setMe((prof || null) as any)
    await loadProfiles()
    setLoading(false)
  }

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .limit(5000)

    const map = new Map<string, Profile>()
    ;(data || []).forEach((p: any) => map.set(p.id, p as Profile))
    setProfileMap(map)
  }

  async function load() {
    setLoading(true)
    setToast(null)

    const picked = dayPick ? new Date(dayPick) : new Date()
    const dayStart = startOfDayISO(picked)
    const dayEnd = endOfDayISO(picked)

    const weekStart = startOfWeekISO(new Date())
    const monthStart = startOfMonthISO(new Date())

    // deal pulls (keep light)
    const [{ data: dayDeals, error: dayErr }, { data: weekDeals, error: weekErr }, { data: monthDeals, error: monthErr }] =
      await Promise.all([
        supabase.from('deals').select('id, created_at, agent_id, premium').gte('created_at', dayStart).lte('created_at', dayEnd),
        supabase.from('deals').select('id, created_at, agent_id, premium').gte('created_at', weekStart),
        supabase.from('deals').select('id, created_at, agent_id, premium').gte('created_at', monthStart),
      ])

    if (dayErr || weekErr || monthErr) {
      setToast('Could not load dashboard data')
      setLoading(false)
      return
    }

    const sumPremium = (arr: any[]) =>
      (arr || []).reduce((a, r) => a + (Number(r.premium || 0) || 0), 0)

    setTodayProd(sumPremium(dayDeals || []))
    setWeekProd(sumPremium(weekDeals || []))
    setMonthProd(sumPremium(monthDeals || []))

    // writing agents = unique agent_id who wrote in THIS WEEK (feel free to change to picked day later)
    const weekAgentIds = Array.from(new Set((weekDeals || []).map((d: any) => d.agent_id).filter(Boolean)))
    setWritingAgents(weekAgentIds.length)

    // top carrier -> now "deals submitted" (count for picked day)
    const dealsSubmittedPickedDay = (dayDeals || []).length

    // Production donut = this month production
    setDonutA(sumPremium(monthDeals || []))
    // Writing agents donut = count * 1000 just to have a visual scale without chart libs
    setDonutB((weekAgentIds.length || 0) * 1000)
    // Deals submitted donut = count * 500 just to visualize
    setDonutC((dealsSubmittedPickedDay || 0) * 500)

    // Top 5 leaderboard (this month) + ensure logged-in agent ALWAYS shown at top of right-side list
    const monthAgg = new Map<string, number>()
    ;(monthDeals || []).forEach((d: any) => {
      const aId = d.agent_id
      if (!aId) return
      const p = Number(d.premium || 0) || 0
      monthAgg.set(aId, (monthAgg.get(aId) || 0) + p)
    })

    const monthRows = Array.from(monthAgg.entries())
      .map(([agent_id, total]) => ({
        agent_id,
        total,
        name: nameFromProfile(profileMap.get(agent_id) || null) || 'Agent',
      }))
      .sort((a, b) => b.total - a.total)

    const meId = (me as any)?.id
    const meRow = meId
      ? {
          agent_id: meId,
          total: monthAgg.get(meId) || 0,
          name: nameFromProfile(profileMap.get(meId) || me) || 'Me',
        }
      : null

    const top = monthRows.slice(0, 5)

    // If me isn't already in top 5, show me first then show top 5 below (as requested)
    const finalTop5 =
      meRow && !top.some((x) => x.agent_id === meRow.agent_id) ? [meRow, ...top] : top

    setTop5(finalTop5.slice(0, meRow ? 6 : 5))

    // Top 3 cards (picked day)
    setTopCard({ label: 'Deals Submitted', value: dealsSubmittedPickedDay })

    // Recent activity (picked day) — show Agent Name + Premium + Time (by hour)
    const recent = (dayDeals || [])
      .slice()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
      .map((d: any) => {
        const agent = nameFromProfile(profileMap.get(d.agent_id || '') || null) || 'Agent'
        return {
          id: d.id,
          created_at: d.created_at,
          agent,
          premium: Number(d.premium || 0) || 0,
        }
      })

    setActivity(recent)

    setLoading(false)
  }

  const welcomeName = useMemo(() => {
    const n = nameFromProfile(me)
    return n || 'Agent'
  }, [me])

  const pickedLabel = useMemo(() => {
    const d = dayPick ? new Date(dayPick) : new Date()
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
  }, [dayPick])

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
        {/* HEADER */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">Welcome Back {welcomeName}</p>
          </div>

          <button onClick={load} className={btnGlass}>
            Refresh
          </button>
        </div>

        {/* TOP GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* CARD 1 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 relative overflow-hidden">
            <div className="absolute top-4 right-4 w-[240px]">
              {/* small date picker */}
              <FlowDatePicker value={dayPick} onChange={setDayPick} />
            </div>

            <div className="text-xs text-white/60">Production</div>
            <div className="mt-3 text-4xl font-black tracking-tight">{money(todayProd)}</div>
            <div className="mt-2 text-xs text-white/55">{pickedLabel}</div>
          </div>

          {/* CARD 2 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-white/60">Writing Agents ✅</div>
            <div className="mt-3 text-4xl font-black tracking-tight">{writingAgents.toLocaleString()}</div>
            <div className="mt-2 text-xs text-white/55">This week</div>
          </div>

          {/* CARD 3 */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-white/60">Deals Submitted</div>
            <div className="mt-3 text-4xl font-black tracking-tight">{topCard.value.toLocaleString()}</div>
            <div className="mt-2 text-xs text-white/55">{pickedLabel}</div>
          </div>
        </div>

        {/* MAIN */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* LEFT 2 COLS */}
          <div className="xl:col-span-2 space-y-6">
            {/* FLOW TREND + DONUTS */}
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Flow Trend</div>
                  <div className="text-xs text-white/55 mt-1">Simple visual — fast & clean.</div>
                </div>
                <div className="text-xs text-white/55">{pickedLabel}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Donut label="Production" value={donutA} max={Math.max(donutA, donutB, donutC, 1)} />
                <Donut label="Writing Agents ✅" value={donutB} max={Math.max(donutA, donutB, donutC, 1)} />
                <Donut label="Deals Submitted" value={donutC} max={Math.max(donutA, donutB, donutC, 1)} />
              </div>
            </div>

            {/* PRODUCTION (TODAY/WEEK/MONTH) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-xs text-white/60">Today’s production</div>
                <div className="mt-3 text-3xl font-black">{money(todayProd)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-xs text-white/60">This weeks production</div>
                <div className="mt-3 text-3xl font-black">{money(weekProd)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-xs text-white/60">This months production</div>
                <div className="mt-3 text-3xl font-black">{money(monthProd)}</div>
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
                <div className="text-sm font-semibold">Recent Activity</div>
                <div className="text-xs text-white/55">{pickedLabel}</div>
              </div>

              {loading ? (
                <div className="px-6 py-10 text-center text-white/60">Loading…</div>
              ) : activity.length === 0 ? (
                <div className="px-6 py-10 text-center text-white/60">No activity.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {activity.map((a) => (
                    <div key={a.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{a.agent}</div>
                        <div className="text-xs text-white/55 mt-1">{hourLabel(a.created_at)}</div>
                      </div>
                      <div className="text-sm font-extrabold">{money(a.premium)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-6">
            {/* LEADERBOARD PREVIEW */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
                <div className="text-sm font-semibold">Leaderboard</div>

                <Link
                  href="/leaderboard"
                  className="text-xs font-semibold text-white/70 hover:text-white transition"
                >
                  All results →
                </Link>
              </div>

              <div className="px-6 py-4">
                <div className="text-xs text-white/55 mb-3">Top 5</div>

                {loading ? (
                  <div className="py-6 text-center text-white/60 text-sm">Loading…</div>
                ) : top5.length === 0 ? (
                  <div className="py-6 text-center text-white/60 text-sm">No results.</div>
                ) : (
                  <div className="space-y-2">
                    {top5.map((r, i) => (
                      <div
                        key={r.agent_id + i}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-white/55 w-6">{i + 1}</div>
                          <div className="text-sm font-semibold">{r.name}</div>
                        </div>
                        <div className="text-sm font-extrabold">{money(r.total)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* QUICK NOTE */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold">Morning Flow Snapshot</div>
              <div className="text-xs text-white/55 mt-2">
                Clean signal, no noise.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'
