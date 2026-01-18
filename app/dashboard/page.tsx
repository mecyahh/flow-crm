'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type DealRow = {
  id: string
  created_at: string
  agent_id: string | null
  premium: number | null
  company: string | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isoDay(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inDay(iso: string, dayISO: string) {
  // created_at is ISO timestamp; match date prefix
  return iso?.slice(0, 10) === dayISO
}

function nameOf(p?: ProfileRow | null) {
  const n = `${p?.first_name || ''} ${p?.last_name || ''}`.trim()
  return n || p?.email || 'Agent'
}

export default function DashboardPage() {
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [me, setMe] = useState<ProfileRow | null>(null)
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})

  const [deals, setDeals] = useState<DealRow[]>([])
  const [dayPick, setDayPick] = useState<string>(isoDay(new Date()))

  // goal values (admin editable later)
  const [weeklyGoal, setWeeklyGoal] = useState<number>(25000)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(100000)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)

    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id || null

    if (uid) {
      const { data: myProf } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('id', uid).single()
      if (myProf) setMe(myProf as ProfileRow)
    }

    const { data: profs, error: pErr } = await supabase.from('profiles').select('id, first_name, last_name, email').limit(5000)
    if (pErr) setToast('Could not load profiles (RLS)')
    const map: Record<string, ProfileRow> = {}
    ;(profs || []).forEach((r: any) => (map[r.id] = r))
    setProfiles(map)

    const since = new Date()
    since.setDate(since.getDate() - 45) // enough window for dashboard + leaderboard preview
    const { data: d, error: dErr } = await supabase
      .from('deals')
      .select('id, created_at, agent_id, premium, company')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000)

    if (dErr) setToast('Could not load deals (RLS)')
    setDeals((d || []) as DealRow[])

    setLoading(false)
  }

  const dayDeals = useMemo(() => deals.filter((x) => inDay(x.created_at, dayPick)), [deals, dayPick])

  const productionToday = useMemo(() => {
    return dayDeals.reduce((sum, r) => sum + (Number(r.premium) || 0), 0)
  }, [dayDeals])

  const now = new Date()
  const startOfWeek = useMemo(() => {
    const d = new Date(now)
    const day = d.getDay() // 0 sun
    const diff = (day === 0 ? -6 : 1) - day // monday start
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }, [now])

  const startOfMonth = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [now])

  const thisWeekDeals = useMemo(() => deals.filter((x) => new Date(x.created_at).getTime() >= startOfWeek.getTime()), [deals, startOfWeek])
  const thisMonthDeals = useMemo(() => deals.filter((x) => new Date(x.created_at).getTime() >= startOfMonth.getTime()), [deals, startOfMonth])

  const productionWeek = useMemo(() => thisWeekDeals.reduce((s, r) => s + (Number(r.premium) || 0), 0), [thisWeekDeals])
  const productionMonth = useMemo(() => thisMonthDeals.reduce((s, r) => s + (Number(r.premium) || 0), 0), [thisMonthDeals])

  const dealsSubmitted = useMemo(() => dayDeals.length, [dayDeals])

  const writingAgents = useMemo(() => {
    const set = new Set<string>()
    dayDeals.forEach((d) => {
      if (d.agent_id) set.add(d.agent_id)
    })
    return set.size
  }, [dayDeals])

  const top5 = useMemo(() => {
    const byAgent: Record<string, number> = {}
    thisMonthDeals.forEach((d) => {
      const aid = d.agent_id || 'unknown'
      byAgent[aid] = (byAgent[aid] || 0) + (Number(d.premium) || 0)
    })
    const arr = Object.entries(byAgent)
      .map(([agent_id, total]) => ({ agent_id, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
    return arr
  }, [thisMonthDeals])

  const recentActivity = useMemo(() => {
    return deals
      .slice(0, 8)
      .map((d) => ({
        id: d.id,
        agent: nameOf(d.agent_id ? profiles[d.agent_id] : null),
        premium: Number(d.premium) || 0,
        time: new Date(d.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      }))
  }, [deals, profiles])

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
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">Welcome Back {nameOf(me)}</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={boot} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="glass rounded-2xl border border-white/10 p-10 text-center text-white/60">Loading dashboard…</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* LEFT (2 cols) */}
            <div className="xl:col-span-2 space-y-6">
              {/* TOP 3 CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass rounded-2xl border border-white/10 p-5 relative overflow-hidden">
                  <div className="absolute top-4 left-4 w-[220px]">
                    <FlowDatePicker value={dayPick} onChange={setDayPick} />
                  </div>
                  <div className="pt-16">
                    <div className="text-xs text-white/60">Production</div>
                    <div className="mt-2 text-2xl font-semibold">${money(productionToday)}</div>
                  </div>
                </div>

                <div className="glass rounded-2xl border border-white/10 p-5">
                  <div className="text-xs text-white/60">Writing Agents ✅</div>
                  <div className="mt-2 text-2xl font-semibold">{writingAgents}</div>
                </div>

                <div className="glass rounded-2xl border border-white/10 p-5">
                  <div className="text-xs text-white/60">Deals Submitted</div>
                  <div className="mt-2 text-2xl font-semibold">{dealsSubmitted}</div>
                </div>
              </div>

              {/* TODAY / WEEK / MONTH PRODUCTION */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass rounded-2xl border border-white/10 p-5">
                  <div className="text-xs text-white/60">Today’s production</div>
                  <div className="mt-2 text-2xl font-semibold">${money(productionToday)}</div>
                </div>
                <div className="glass rounded-2xl border border-white/10 p-5">
                  <div className="text-xs text-white/60">This weeks production</div>
                  <div className="mt-2 text-2xl font-semibold">${money(productionWeek)}</div>
                </div>
                <div className="glass rounded-2xl border border-white/10 p-5">
                  <div className="text-xs text-white/60">This months production</div>
                  <div className="mt-2 text-2xl font-semibold">${money(productionMonth)}</div>
                </div>
              </div>

              {/* GOALS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/60">Weekly Goal</div>
                      <div className="mt-1 text-xl font-semibold">${money(weeklyGoal)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/60">Progress</div>
                      <div className="mt-1 text-xl font-semibold">${money(productionWeek)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-white/60"
                        style={{ width: `${Math.min(100, (productionWeek / Math.max(1, weeklyGoal)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-white/60">Monthly Goal</div>
                      <div className="mt-1 text-xl font-semibold">${money(monthlyGoal)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/60">Progress</div>
                      <div className="mt-1 text-xl font-semibold">${money(productionMonth)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-white/60"
                        style={{ width: `${Math.min(100, (productionMonth / Math.max(1, monthlyGoal)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT ACTIVITY */}
              <div className="glass rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
                  <div className="text-sm font-semibold">Recent Activity</div>
                </div>

                <div className="divide-y divide-white/10">
                  {recentActivity.map((r) => (
                    <div key={r.id} className="px-6 py-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{r.agent}</div>
                        <div className="text-xs text-white/55 mt-1">{r.time}</div>
                      </div>
                      <div className="text-sm font-semibold">${money(r.premium)}</div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && <div className="px-6 py-8 text-center text-white/60">No activity.</div>}
                </div>
              </div>
            </div>

            {/* RIGHT (Leaderboard preview) */}
            <div className="space-y-6">
              <div className="glass rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">Leaderboard</div>
                    <Link href="/leaderboard" className="mt-1 inline-block text-sm font-semibold hover:underline">
                      All results →
                    </Link>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {/* Always show me first */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-white/60">You</div>
                    <div className="mt-1 text-sm font-semibold">{nameOf(me)}</div>
                  </div>

                  {top5.map((x, idx) => (
                    <div key={x.agent_id + idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/60">#{idx + 1}</div>
                        <div className="mt-1 text-sm font-semibold">{nameOf(profiles[x.agent_id])}</div>
                      </div>
                      <div className="text-sm font-semibold">${money(x.total)}</div>
                    </div>
                  ))}

                  {top5.length === 0 && <div className="text-sm text-white/60">No data yet.</div>}
                </div>

                {/* Keep blank per your request */}
                <div className="mt-5 text-xs text-white/40">{/* Total premium last 7 days (removed) */}</div>
              </div>

              <div className="glass rounded-2xl border border-white/10 p-6">
                <div className="text-sm font-semibold">Flow Trend</div>
                <div className="text-xs text-white/55 mt-1">Clean signal. No noise.</div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] text-white/55">Production</div>
                    <div className="mt-1 text-sm font-semibold">${money(productionMonth)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] text-white/55">Writing Agents</div>
                    <div className="mt-1 text-sm font-semibold">{new Set(thisMonthDeals.map((d) => d.agent_id || 'unknown')).size}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] text-white/55">Deals Submitted</div>
                    <div className="mt-1 text-sm font-semibold">{thisMonthDeals.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
