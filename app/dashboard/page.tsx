'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import FlowLineChart from '../components/FlowLineChart'
import CarrierDonut from '../components/CarrierDonut'
import GoalDonuts from '../components/GoalDonuts'
import { supabase } from '@/lib/supabaseClient'

type DealRow = {
  id: string
  agent_id?: string | null
  user_id?: string | null
  created_at: string
  premium: any
  company: string | null
  note?: string | null
}

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string
  is_agency_owner: boolean
}

type LeaderRow = { user_id: string; name: string; ap: number }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<Profile | null>(null)

  // Personal deals (agent view) OR team deals (owner/admin view)
  const [deals, setDeals] = useState<DealRow[]>([])

  // Agency leaderboard (global, top 5)
  const [leaders, setLeaders] = useState<LeaderRow[]>([])

  useEffect(() => {
    let alive = true

    ;(async () => {
      setLoading(true)

      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      const user = userRes.user
      if (userErr || !user) {
        window.location.href = '/login'
        return
      }

      // Load my profile (fixes name sync)
      const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!alive) return
      if (profErr || !prof) {
        setMe(null)
      } else {
        setMe(prof as Profile)
      }

      const isOwnerOrAdmin = !!(prof && ((prof as any).role === 'admin' || (prof as any).is_agency_owner))

      // Personal dataset for agents; team dataset for owners/admin
      const dealsQuery = supabase
        .from('deals')
        .select('id,agent_id,user_id,created_at,premium,company,note')
        .order('created_at', { ascending: false })
        .limit(2000)

      const { data, error } = isOwnerOrAdmin
        ? await dealsQuery
        : await dealsQuery.eq('user_id', user.id)

      if (!alive) return

      if (error) {
        setDeals([])
        setLeaders([])
        setLoading(false)
        return
      }

      setDeals((data as DealRow[]) || [])

      // Agency leaderboard always global for everyone
      const builtLeaders = await buildAgencyLeaders()
      if (!alive) return
      setLeaders(builtLeaders)

      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [])

  async function buildAgencyLeaders(): Promise<LeaderRow[]> {
    // Pull recent deals and aggregate AP by user_id
    const { data: d } = await supabase
      .from('deals')
      .select('user_id,premium,created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    const map = new Map<string, number>()
    ;(d || []).forEach((row: any) => {
      const uid = row.user_id
      if (!uid) return
      const prem = toPremium(row.premium)
      map.set(uid, (map.get(uid) || 0) + prem)
    })

    const top = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Map ids -> names
    const ids = top.map((t) => t[0])
    if (!ids.length) return []

    const { data: ps } = await supabase
      .from('profiles')
      .select('id,first_name,last_name,email')
      .in('id', ids)

    const pmap = new Map<string, any>()
    ;(ps || []).forEach((p: any) => pmap.set(p.id, p))

    return top.map(([uid, ap]) => {
      const p = pmap.get(uid)
      const name =
        [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
        (p?.email ? String(p.email).split('@')[0] : '—')
      return { user_id: uid, name, ap }
    })
  }

  const now = new Date()

  const parsed = useMemo(() => {
    return deals.map((d) => {
      const dt = d.created_at ? new Date(d.created_at) : new Date()
      const premiumNum = toPremium(d.premium)

      return {
        ...d,
        dt,
        premiumNum,
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

  const todayDeals = useMemo(() => parsed.filter((d) => d.dt >= todayStart), [parsed, todayStart])
  const weekDeals = useMemo(() => parsed.filter((d) => d.dt >= weekStart), [parsed, weekStart])
  const monthDeals = useMemo(() => parsed.filter((d) => d.dt >= monthStart), [parsed, monthStart])

  const teamTotal = useMemo(() => monthDeals.reduce((s, d) => s + d.premiumNum, 0), [monthDeals])

  const writingAgents = useMemo(() => {
    const uniq = new Set(monthDeals.map((d) => d.user_id || d.agent_id).filter(Boolean) as string[])
    return uniq.size
  }, [monthDeals])

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

  const weeklyGoal = 20
  const monthlyGoal = 90

  const myName =
    [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim() ||
    (me?.email ? String(me.email).split('@')[0] : '—')

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      <div className="ml-64">
        <header className="px-10 pt-10 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">Welcome Back {myName}</p>
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
            <MiniStat label="Production" value={loading ? '—' : `$${formatMoney(teamTotal)}`} />
            <MiniStat label="Writing Agents" value={loading ? '—' : String(writingAgents)} />
            <MiniStat label="Deals Submitted" value={loading ? '—' : String(monthDeals.length)} />
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
                <KPI title="Today" value={loading ? '—' : `$${formatMoney(sumPremium(todayDeals))}`} sub="Today's production" />
                <KPI title="This Week" value={loading ? '—' : `$${formatMoney(sumPremium(weekDeals))}`} sub="This weeks production" />
                <KPI title="This Month" value={loading ? '—' : `$${formatMoney(sumPremium(monthDeals))}`} sub="This months production" />
              </div>
            </div>

            <div className="glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Leaderboard</h2>
                <Link href="/leaderboard" className="text-xs text-white/60 hover:text-white transition">
                  All results →
                </Link>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-5">
                <CarrierDonut labels={carrierDist.labels} values={carrierDist.values} />
              </div>

              <div className="space-y-3">
                {(loading ? [] : leaders).map((l, idx) => (
                  <Leader key={l.user_id} rank={idx + 1} name={l.name} amount={`$${formatMoney(l.ap)}`} highlight={idx === 0} />
                ))}
                {!loading && leaders.length === 0 && <Leader rank={1} name="—" amount="—" />}
              </div>

              <div className="mt-4 text-xs text-white/50">Agency leaderboard (global).</div>
            </div>
          </section>

          <section className="mt-6 glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <span className="text-xs text-white/60">Latest submissions</span>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <Row head left="Agent" mid="Premium" right="Time" />
              {(loading ? [] : parsed.slice(0, 6)).map((d) => (
                <Row
                  key={d.id}
                  left={myName} // dashboard activity is personal for agents, rolled up for owners/admin by query
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

function sumPremium(rows: any[]) {
  return rows.reduce((s, d) => s + (d.premiumNum || 0), 0)
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
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${
            highlight ? 'bg-blue-600' : 'bg-white/10'
          }`}
        >
          {rank}
        </div>
        <div>
          <div className={`${highlight ? 'text-base font-semibold' : 'text-sm font-medium'}`}>{name}</div>
          <div className="text-xs text-white/50">Weekly production</div>
        </div>
      </div>

      <div className={`${highlight ? 'text-lg font-semibold' : 'text-sm font-semibold'} text-green-400`}>
        {amount}
      </div>
    </div>
  )
}

function Row({ head, left, mid, right }: { head?: boolean; left: string; mid: string; right: string }) {
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

function toPremium(p: any) {
  const n =
    typeof p === 'number'
      ? p
      : typeof p === 'string'
      ? Number(p.replace(/[^0-9.]/g, ''))
      : Number(p || 0)
  return Number.isFinite(n) ? n : 0
}
