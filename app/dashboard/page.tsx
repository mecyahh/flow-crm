// /app/dashboard/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import FlowLineChart from '../components/FlowLineChart'
import CarrierDonut from '../components/CarrierDonut'
import GoalDonuts from '../components/GoalDonuts'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type DealRow = {
  id: string
  user_id: string
  created_at: string
  premium: any
  company: string | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [meName, setMeName] = useState<string>('Agent')

  // NEW: top cards date picker (glass)
  const [dayPick, setDayPick] = useState<string>(() => {
    const n = new Date()
    const y = n.getFullYear()
    const m = String(n.getMonth() + 1).padStart(2, '0')
    const d = String(n.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  useEffect(() => {
    let alive = true

    ;(async () => {
      setLoading(true)

      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) {
        window.location.href = '/login'
        return
      }

      // NEW: Welcome Back {username}
      const { data: prof } = await supabase
        .from('profiles')
        .select('id,first_name,last_name,email')
        .eq('id', user.id)
        .single()

      const nm =
        `${(prof?.first_name || '').trim()} ${(prof?.last_name || '').trim()}`.trim() ||
        (prof?.email || '').trim() ||
        'Agent'

      const { data, error } = await supabase
        .from('deals')
        .select('id,user_id,created_at,premium,company')
        .order('created_at', { ascending: false })
        .limit(2500)

      if (!alive) return

      setMeName(nm)

      if (error) {
        setDeals([])
        setLoading(false)
        return
      }

      setDeals((data as DealRow[]) || [])
      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [])

  const now = new Date()

  const parsed = useMemo(() => {
    return deals.map((d) => {
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
        premiumNum: isNaN(premiumNum) ? 0 : premiumNum,
        companySafe: (d.company || 'Other').trim() || 'Other',
      }
    })
  }, [deals])

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const startOfWeek = (d: Date) => {
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const base = new Date(d)
    base.setDate(d.getDate() + diff)
    return startOfDay(base)
  }
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

  const todayStart = startOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  // NEW: chosen day start/end
  const pickStart = useMemo(() => {
    const [y, m, d] = dayPick.split('-').map((x) => Number(x))
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
  }, [dayPick])

  const pickEnd = useMemo(() => {
    const e = new Date(pickStart)
    e.setDate(e.getDate() + 1)
    return e
  }, [pickStart])

  // FILTERS
  const todayDeals = useMemo(() => parsed.filter((d) => d.dt >= todayStart), [parsed, todayStart])
  const weekDeals = useMemo(() => parsed.filter((d) => d.dt >= weekStart), [parsed, weekStart])
  const monthDeals = useMemo(() => parsed.filter((d) => d.dt >= monthStart), [parsed, monthStart])

  // NEW: “Team Total” should show Production (for selected day)
  const dayDealsPicked = useMemo(
    () => parsed.filter((d) => d.dt >= pickStart && d.dt < pickEnd),
    [parsed, pickStart, pickEnd]
  )

  const dayProduction = useMemo(
    () => dayDealsPicked.reduce((s, d) => s + d.premiumNum, 0),
    [dayDealsPicked]
  )

  // NEW: deals submitted (for selected day) to replace Top Carrier card
  const dayDealsCount = useMemo(() => dayDealsPicked.length, [dayDealsPicked])

  // NEW: writing agents should be for selected day
  const writingAgents = useMemo(() => {
    const uniq = new Set(dayDealsPicked.map((d) => d.user_id))
    return uniq.size
  }, [dayDealsPicked])

  // KEEP: Flow Trend top carrier logic (month) BUT label changes handled in UI
  const topCarrier = useMemo(() => {
    const map = new Map<string, number>()
    monthDeals.forEach((d) => map.set(d.companySafe, (map.get(d.companySafe) || 0) + 1))
    let best = '—'
    let bestCount = 0
    for (const [k, v] of map.entries()) {
      if (v > bestCount) {
        best = k
        bestCount = v
      }
    }
    return bestCount === 0 ? '—' : best
  }, [monthDeals])

  const last7 = useMemo(() => {
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStart = startOfDay(d)
      const next = new Date(dStart)
      next.setDate(dStart.getDate() + 1)

      const count = parsed.filter((x) => x.dt >= dStart && x.dt < next).length
      const label = d.toLocaleDateString(undefined, { weekday: 'short' })
      days.push({ label, count })
    }
    return days
  }, [parsed])

  const lineLabels = useMemo(() => last7.map((x) => x.label), [last7])
  const lineValues = useMemo(() => last7.map((x) => x.count), [last7])

  const carrierDist = useMemo(() => {
    const map = new Map<string, number>()
    monthDeals.forEach((d) => map.set(d.companySafe, (map.get(d.companySafe) || 0) + 1))
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const labels = entries.length ? entries.map((e) => e[0]) : ['No Data']
    const values = entries.length ? entries.map((e) => e[1]) : [100]
    return { labels, values }
  }, [monthDeals])

  // NEW: production totals for KPI cards (today/week/month) but show premium totals
  const todaysProduction = useMemo(
    () => todayDeals.reduce((s, d) => s + d.premiumNum, 0),
    [todayDeals]
  )
  const weeksProduction = useMemo(
    () => weekDeals.reduce((s, d) => s + d.premiumNum, 0),
    [weekDeals]
  )
  const monthsProduction = useMemo(
    () => monthDeals.reduce((s, d) => s + d.premiumNum, 0),
    [monthDeals]
  )

  // NEW: leaderboard top 5 (real) + always show me on top above them
  const [leaderRows, setLeaderRows] = useState<
    { user_id: string; name: string; premium: number }[]
  >([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) return

      const map = new Map<string, number>()
      monthDeals.forEach((d) => {
        map.set(d.user_id, (map.get(d.user_id) || 0) + d.premiumNum)
      })

      const ids = Array.from(map.keys())
      let profs: ProfileRow[] = []
      if (ids.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id,first_name,last_name,email')
          .in('id', ids)
        profs = (data || []) as ProfileRow[]
      }

      const nameById = new Map<string, string>()
      profs.forEach((p) => {
        const nm =
          `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim() ||
          (p.email || '').trim() ||
          'Agent'
        nameById.set(p.id, nm)
      })

      const sorted = ids
        .map((id) => ({
          user_id: id,
          name: nameById.get(id) || 'Agent',
          premium: map.get(id) || 0,
        }))
        .sort((a, b) => b.premium - a.premium)

      const me = sorted.find((x) => x.user_id === user.id) || {
        user_id: user.id,
        name: meName || 'You',
        premium: map.get(user.id) || 0,
      }

      const top5 = sorted.slice(0, 5)
      const rest = top5.filter((x) => x.user_id !== user.id)

      if (!alive) return
      setLeaderRows([me, ...rest].slice(0, 5))
    })()

    return () => {
      alive = false
    }
  }, [monthDeals, meName])

  const weeklyGoal = 20
  const monthlyGoal = 90

  // NEW: Recent activity should show agent name + hour
  const recentRows = useMemo(() => {
    return (loading ? [] : parsed.slice(0, 6)).map((d) => ({
      id: d.id,
      agentId: d.user_id,
      premium: d.premiumNum,
      dt: d.dt,
    }))
  }, [parsed, loading])

  const [recentNames, setRecentNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let alive = true
    ;(async () => {
      const ids = Array.from(new Set(recentRows.map((r) => r.agentId))).filter(Boolean)
      if (!ids.length) return
      const { data } = await supabase
        .from('profiles')
        .select('id,first_name,last_name,email')
        .in('id', ids)

      const m = new Map<string, string>()
      ;((data || []) as ProfileRow[]).forEach((p) => {
        const nm =
          `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim() ||
          (p.email || '').trim() ||
          'Agent'
        m.set(p.id, nm)
      })

      if (!alive) return
      setRecentNames(m)
    })()
    return () => {
      alive = false
    }
  }, [recentRows])

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      <div className="ml-64">
        <header className="px-10 pt-10 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">Welcome Back {meName}</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition">
              Notifications
            </button>
            <a
              href="/post-deal"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition"
            >
              Post a Deal
            </a>
          </div>
        </header>

        <main className="px-10 pb-12">
          {/* TOP 3 CARDS (same layout) + glass date picker in top-left */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="glass p-6 relative overflow-hidden">
              <div className="absolute top-4 left-4 w-[190px]">
                <FlowDatePicker value={dayPick} onChange={setDayPick} />
              </div>
              <div className="pt-14">
                <MiniStat
                  label="Production"
                  value={loading ? '—' : `$${formatMoneyPrecise(dayProduction)}`}
                />
              </div>
            </div>

            <MiniStat label="Writing Agents ✅" value={loading ? '—' : String(writingAgents)} />

            <MiniStat
              label="Deals submitted"
              value={loading ? '—' : String(dayDealsCount)}
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Flow Trend</h2>
                <span className="text-xs text-white/60">Last 7 days</span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <FlowLineChart labels={lineLabels} values={lineValues} />
              </div>

              <div className="mt-6">
                <GoalDonuts
                  weeklyCurrent={weekDeals.length}
                  weeklyGoal={weeklyGoal}
                  monthlyCurrent={monthDeals.length}
                  monthlyGoal={monthlyGoal}
                />
              </div>

              {/* KPI CARDS (same layout, swapped copy + values) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <KPI
                  title="Today’s production"
                  value={loading ? '—' : `$${formatMoneyPrecise(todaysProduction)}`}
                  sub=""
                />
                <KPI
                  title="This weeks production"
                  value={loading ? '—' : `$${formatMoneyPrecise(weeksProduction)}`}
                  sub=""
                />
                <KPI
                  title="This months production"
                  value={loading ? '—' : `$${formatMoneyPrecise(monthsProduction)}`}
                  sub=""
                />
              </div>
            </div>

            <div className="glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Leaderboard</h2>
                <Link href="/leaderboard" className="text-xs text-white/60 hover:underline">
                  All results →
                </Link>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-5">
                <CarrierDonut labels={carrierDist.labels} values={carrierDist.values} />
              </div>

              {/* You first, then top 5 real */}
              <div className="space-y-3">
                {leaderRows.length === 0 ? (
                  <Leader rank={1} name="You" amount={loading ? '—' : '$0.00'} highlight />
                ) : (
                  leaderRows.map((r, idx) => (
                    <Leader
                      key={r.user_id}
                      rank={idx + 1}
                      name={idx === 0 ? r.name : r.name}
                      amount={loading ? '—' : `$${formatMoneyPrecise(r.premium)}`}
                      highlight={idx === 0}
                    />
                  ))
                )}
              </div>

              <div className="mt-4 text-xs text-white/50">
                Top carrier this month: {loading ? '—' : topCarrier}
              </div>
            </div>
          </section>

          <section className="mt-6 glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <span className="text-xs text-white/60">Latest submissions</span>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <Row head left="Agent" mid="Premium ✅" right="Time" />
              {recentRows.map((r) => (
                <Row
                  key={r.id}
                  left={recentNames.get(r.agentId) || 'Agent'}
                  mid={`$${formatMoneyPrecise(r.premium)}`}
                  right={byHour(r.dt)}
                />
              ))}
              {!loading && parsed.length === 0 && <Row left="—" mid="No deals yet" right="—" />}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function KPI({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-white/60">{title}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold">{value}</span>
        {sub ? <span className="text-xs text-white/50">{sub}</span> : null}
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

function Leader({
  rank,
  name,
  amount,
  highlight,
}: {
  rank: number
  name: string
  amount: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 ${
        highlight ? 'bg-white/10' : 'bg-white/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
            highlight ? 'bg-blue-600' : 'bg-white/10'
          }`}
        >
          {rank}
        </div>
        <div>
          <div className={`${highlight ? 'text-base font-semibold' : 'text-sm font-medium'}`}>
            {name}
          </div>
          <div className="text-xs text-white/50">Monthly production</div>
        </div>
      </div>

      <div className={`${highlight ? 'text-lg font-semibold' : 'text-sm font-semibold'} text-green-400`}>
        {amount}
      </div>
    </div>
  )
}

function Row({
  head,
  left,
  mid,
  right,
}: {
  head?: boolean
  left: string
  mid: string
  right: string
}) {
  return (
    <div
      className={`grid grid-cols-3 px-4 py-3 border-b border-white/10 ${
        head ? 'text-xs text-white/60 bg-white/5' : 'text-sm'
      }`}
    >
      <div>{left}</div>
      <div className="text-center">{mid}</div>
      <div className="text-right">{right}</div>
    </div>
  )
}

function formatMoneyPrecise(n: number) {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function byHour(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}
