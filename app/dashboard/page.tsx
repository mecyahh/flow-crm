'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import FlowLineChart from '../components/FlowLineChart'
import CarrierDonut from '../components/CarrierDonut'
import GoalDonuts from '../components/GoalDonuts'
import { supabase } from '@/lib/supabaseClient'

type DealRow = {
  id: string
  user_id: string
  created_at: string
  premium: any
  company: string | null
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [deals, setDeals] = useState<DealRow[]>([])

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

      const { data, error } = await supabase
        .from('deals')
        .select('id,user_id,created_at,premium,company')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500)

      if (!alive) return

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
    return deals.map(d => {
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

  const todayDeals = useMemo(() => parsed.filter(d => d.dt >= todayStart), [parsed, todayStart])
  const weekDeals = useMemo(() => parsed.filter(d => d.dt >= weekStart), [parsed, weekStart])
  const monthDeals = useMemo(() => parsed.filter(d => d.dt >= monthStart), [parsed, monthStart])

  const teamTotal = useMemo(() => monthDeals.reduce((s, d) => s + d.premiumNum, 0), [monthDeals])

  const writingAgents = useMemo(() => {
    const uniq = new Set(monthDeals.map(d => d.user_id))
    return uniq.size
  }, [monthDeals])

  const topCarrier = useMemo(() => {
    const map = new Map<string, number>()
    monthDeals.forEach(d => map.set(d.companySafe, (map.get(d.companySafe) || 0) + 1))
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

      const count = parsed.filter(x => x.dt >= dStart && x.dt < next).length
      const label = d.toLocaleDateString(undefined, { weekday: 'short' })
      days.push({ label, count })
    }
    return days
  }, [parsed])

  const lineLabels = useMemo(() => last7.map(x => x.label), [last7])
  const lineValues = useMemo(() => last7.map(x => x.count), [last7])

  const carrierDist = useMemo(() => {
    const map = new Map<string, number>()
    monthDeals.forEach(d => map.set(d.companySafe, (map.get(d.companySafe) || 0) + 1))
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const labels = entries.length ? entries.map(e => e[0]) : ['No Data']
    const values = entries.length ? entries.map(e => e[1]) : [100]
    return { labels, values }
  }, [monthDeals])

  const weeklyGoal = 20
  const monthlyGoal = 90

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      <div className="ml-64">
        <header className="px-10 pt-10 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">
              Morning Flow snapshot — clean signal, no noise.
            </p>
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
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <MiniStat label="Team Total" value={loading ? '—' : `$${formatMoney(teamTotal)}`} />
            <MiniStat label="Writing Agents" value={loading ? '—' : String(writingAgents)} />
            <MiniStat label="Top Carrier" value={loading ? '—' : topCarrier} />
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <KPI title="Today" value={loading ? '—' : String(todayDeals.length)} sub="Deals submitted" />
                <KPI title="This Week" value={loading ? '—' : String(weekDeals.length)} sub="Deals submitted" />
                <KPI title="This Month" value={loading ? '—' : String(monthDeals.length)} sub="Deals submitted" />
              </div>
            </div>

            <div className="glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Leaderboard</h2>
                <span className="text-xs text-white/60">This month</span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-5">
                <CarrierDonut labels={carrierDist.labels} values={carrierDist.values} />
              </div>

              <div className="space-y-3">
                <Leader rank={1} name="You" amount={loading ? '—' : `$${formatMoney(teamTotal)}`} highlight />
              </div>

              <div className="mt-4 text-xs text-white/50">Admin team leaderboard comes next.</div>
            </div>
          </section>

          <section className="mt-6 glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <span className="text-xs text-white/60">Latest submissions</span>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <Row head left="Carrier" mid="Premium" right="Time" />
              {(loading ? [] : parsed.slice(0, 6)).map(d => (
                <Row
                  key={d.id}
                  left={d.companySafe}
                  mid={`$${formatMoney(d.premiumNum)}`}
                  right={timeAgo(d.dt)}
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
        <span className="text-xs text-white/50">{sub}</span>
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
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${highlight ? 'bg-blue-600' : 'bg-white/10'}`}>
          {rank}
        </div>
        <div>
          <div className={`${highlight ? 'text-base font-semibold' : 'text-sm font-medium'}`}>{name}</div>
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
    <div className={`grid grid-cols-3 px-4 py-3 border-b border-white/10 ${head ? 'text-xs text-white/60 bg-white/5' : 'text-sm'}`}>
      <div>{left}</div>
      <div className="text-center">{mid}</div>
      <div className="text-right">{right}</div>
    </div>
  )
}

function formatMoney(n: number) {
  return Math.round(n).toLocaleString()
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
