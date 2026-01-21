Here is my dashboard code, I do not want anything changed as far as format or behaviors, but i need these things added into addition: 

Notifications need to show in top right with active feedback on follow ups, recent deals, goals reached, etc
Leaderboard on the right hand side needs to show the agents profile picture and not their icon or generic default
Edit goals tab needs to be in financial values, for commas, decimals and locked so there’s no free text
Leaderboard donut chart needs same UI effect as goals donut progress charts have
DATA SELECTOR CALENDAR SAMe as in the top right corner at the top of the three cards .this must be sleek, thin, accessible, and reflects daat from the datas submitted
Flow trend chart should be clickable, when hovered over it should show realtime updates and color changes like stocks, red, blue, green
Dashboard Top production card should only show personal production for solo agents
Agents with downlines should how the entire teams production
Top right corner i should have a dark mode and light mode toggle switch





// ✅ REPLACE ENTIRE FILE: /app/dashboard/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import FlowLineChart from '../components/FlowLineChart'
import CarrierDonut from '../components/CarrierDonut'
import { supabase } from '@/lib/supabaseClient'

type DealRow = {
  id: string
  user_id: string | null
  created_at: string
  premium: any
  company: string | null
}

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string
  is_agency_owner: boolean
}

type LeaderRow = {
  user_id: string
  name: string
  ap: number
}

type UserGoals = {
  weekly_goal_ap: number
  monthly_goal_ap: number
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<Profile | null>(null)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [leaders, setLeaders] = useState<LeaderRow[]>([])

  // ✅ Goals (editable, persisted)
  const [goals, setGoals] = useState<UserGoals>({ weekly_goal_ap: 2500, monthly_goal_ap: 10000 })
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [goalsSaving, setGoalsSaving] = useState(false)
  const [goalW, setGoalW] = useState('2500')
  const [goalM, setGoalM] = useState('10000')

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

      // Load my profile
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const profile = (prof || null) as Profile | null
      if (!alive) return
      setMe(profile)

      // Load my goals (DB preferred, local fallback)
      if (!alive) return
      await loadGoals(user.id)

      const isOwnerOrAdmin = !!(profile && (profile.role === 'admin' || profile.is_agency_owner))

      // Deals feed: agent = own, owner/admin = all
      const base = supabase
        .from('deals')
        .select('id,user_id,created_at,premium,company')
        .order('created_at', { ascending: false })
        .limit(2000)

      const { data, error } = isOwnerOrAdmin ? await base : await base.eq('user_id', user.id)

      if (!alive) return

      if (error) {
        setDeals([])
        setLeaders([])
        setLoading(false)
        return
      }

      setDeals((data as DealRow[]) || [])

      // Global agency leaderboard (top 5)
      const top5 = await buildAgencyLeaders()
      if (!alive) return
      setLeaders(top5)

      setLoading(false)
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadGoals(uid: string) {
    // Preferred: user_goals table (user_id PK)
    // Fallback: localStorage
    try {
      const { data, error } = await supabase
        .from('user_goals')
        .select('weekly_goal_ap,monthly_goal_ap')
        .eq('user_id', uid)
        .maybeSingle()

      if (!error && data) {
        const w = Number(data.weekly_goal_ap || 0)
        const m = Number(data.monthly_goal_ap || 0)
        const next = {
          weekly_goal_ap: Number.isFinite(w) && w > 0 ? w : 2500,
          monthly_goal_ap: Number.isFinite(m) && m > 0 ? m : 10000,
        }
        setGoals(next)
        setGoalW(String(next.weekly_goal_ap))
        setGoalM(String(next.monthly_goal_ap))
        return
      }
    } catch {}

    try {
      const raw = localStorage.getItem(`flow_goals_${uid}`)
      if (raw) {
        const j = JSON.parse(raw)
        const w = Number(j.weekly_goal_ap || 0)
        const m = Number(j.monthly_goal_ap || 0)
        const next = {
          weekly_goal_ap: Number.isFinite(w) && w > 0 ? w : 2500,
          monthly_goal_ap: Number.isFinite(m) && m > 0 ? m : 10000,
        }
        setGoals(next)
        setGoalW(String(next.weekly_goal_ap))
        setGoalM(String(next.monthly_goal_ap))
        return
      }
    } catch {}

    // default
    setGoals({ weekly_goal_ap: 2500, monthly_goal_ap: 10000 })
    setGoalW('2500')
    setGoalM('10000')
  }

  async function saveGoals() {
    if (!me?.id) return
    if (goalsSaving) return
    setGoalsSaving(true)
    try {
      const w = toMoneyNumber(goalW)
      const m = toMoneyNumber(goalM)
      const next = {
        weekly_goal_ap: Number.isFinite(w) && w > 0 ? w : 2500,
        monthly_goal_ap: Number.isFinite(m) && m > 0 ? m : 10000,
      }

      // Try DB upsert first
      try {
        const res = await supabase.from('user_goals').upsert(
          { user_id: me.id, weekly_goal_ap: next.weekly_goal_ap, monthly_goal_ap: next.monthly_goal_ap },
          { onConflict: 'user_id' }
        )
        if (!res.error) {
          setGoals(next)
          setGoalsOpen(false)
          return
        }
      } catch {}

      // Fallback: local storage
      localStorage.setItem(`flow_goals_${me.id}`, JSON.stringify(next))
      setGoals(next)
      setGoalsOpen(false)
    } finally {
      setGoalsSaving(false)
    }
  }

  async function buildAgencyLeaders(): Promise<LeaderRow[]> {
    // This month deals (global)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const { data: ds, error } = await supabase
      .from('deals')
      .select('user_id,premium,created_at')
      .gte('created_at', monthStart.toISOString())
      .limit(100000)

    if (error || !ds) return []

    const map = new Map<string, number>()
    ds.forEach((r: any) => {
      const uid = r.user_id
      if (!uid) return
      const prem = toPremium(r.premium)
      const ap = prem * 12
      map.set(uid, (map.get(uid) || 0) + ap)
    })

    const top = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const ids = top.map((t) => t[0])
    if (!ids.length) return []

    const { data: ps } = await supabase.from('profiles').select('id,first_name,last_name,email').in('id', ids)

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

  const welcomeName =
    [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim() ||
    (me?.email ? String(me.email).split('@')[0] : '—')

  const now = new Date()

  const parsed = useMemo(() => {
    return deals.map((d) => {
      const dt = d.created_at ? new Date(d.created_at) : new Date()
      const premiumNum = toPremium(d.premium)
      const apNum = premiumNum * 12

      return {
        ...d,
        dt,
        premiumNum,
        apNum,
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

  // ✅ Production (AP) for THIS MONTH (matches the other top stats)
  const production = useMemo(() => sumAP(monthDeals), [monthDeals])

  const writingAgents = useMemo(() => {
    const uniq = new Set(monthDeals.map((d) => d.user_id).filter(Boolean) as string[])
    return uniq.size
  }, [monthDeals])

  const dealsSubmitted = useMemo(() => monthDeals.length, [monthDeals])

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
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const labels = entries.length ? entries.map((e) => e[0]) : ['No Data']
    const values = entries.length ? entries.map((e) => e[1]) : [100]
    return { labels, values }
  }, [monthDeals])

  const todayAP = useMemo(() => sumAP(todayDeals), [todayDeals])
  const weekAP = useMemo(() => sumAP(weekDeals), [weekDeals])
  const monthAP = useMemo(() => sumAP(monthDeals), [monthDeals])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {/* GOALS MODAL */}
      {goalsOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm font-semibold">Edit Goals</div>
                <div className="text-xs text-white/55 mt-1">Saved and locked to your account.</div>
              </div>
              <button onClick={() => setGoalsOpen(false)} className={btnGlass}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Weekly Goal (AP)">
                <input
                  className={inputCls}
                  value={goalW}
                  onChange={(e) => setGoalW(moneyInput(e.target.value))}
                  onBlur={() => setGoalW(String(toMoneyNumber(goalW) || ''))}
                  placeholder="2500"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Monthly Goal (AP)">
                <input
                  className={inputCls}
                  value={goalM}
                  onChange={(e) => setGoalM(moneyInput(e.target.value))}
                  onBlur={() => setGoalM(String(toMoneyNumber(goalM) || ''))}
                  placeholder="10000"
                  inputMode="decimal"
                />
              </Field>
            </div>

            <button
              onClick={saveGoals}
              disabled={goalsSaving}
              className={saveWide + (goalsSaving ? ' opacity-50 cursor-not-allowed' : '')}
            >
              {goalsSaving ? 'Saving…' : 'Save Goals'}
            </button>
          </div>
        </div>
      )}

      <div className="ml-64">
        <header className="px-10 pt-10 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-white/60 mt-1">Welcome Back {welcomeName}</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition">
              Notifications
            </button>
            <a
              href="/post-deal"
              className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-sm font-semibold transition"
              style={{ color: 'var(--accentText)' as any }}
            >
              Post a Deal
            </a>
          </div>
        </header>

        <main className="px-10 pb-12">
          {/* TOP STATS */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <MiniStat label="Production (AP)" value={loading ? '—' : `$${formatMoney(production)}`} />
            <MiniStat label="Writing Agents" value={loading ? '—' : String(writingAgents)} />
            <MiniStat label="Deals Submitted" value={loading ? '—' : String(dealsSubmitted)} />
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
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold">Goals</div>
                  <button
                    type="button"
                    onClick={() => setGoalsOpen(true)}
                    className="glass px-3 py-2 rounded-2xl border border-white/10 hover:bg-white/10 transition inline-flex items-center gap-2 text-xs font-semibold"
                    title="Edit goals"
                  >
                    <GlassEditIcon />
                    Edit
                  </button>
                </div>

                <GoalDonutsLive
                  weeklyCurrentAP={weekAP}
                  weeklyGoalAP={goals.weekly_goal_ap}
                  monthlyCurrentAP={monthAP}
                  monthlyGoalAP={goals.monthly_goal_ap}
                />
              </div>

              {/* ✅ KPI row — ONE header per card + AP values */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <KPI title="Today’s Production (AP)" value={loading ? '—' : `$${formatMoney(todayAP)}`} />
                <KPI title="This Week’s Production (AP)" value={loading ? '—' : `$${formatMoney(weekAP)}`} />
                <KPI title="This Month’s Production (AP)" value={loading ? '—' : `$${formatMoney(monthAP)}`} />
              </div>
            </div>

            {/* RIGHT CARD — global leaderboard + carrier donut */}
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
                  <Leader
                    key={l.user_id}
                    rank={idx + 1}
                    name={l.name}
                    amount={`$${formatMoney(l.ap)}`}
                    highlight={idx === 0}
                  />
                ))}
                {!loading && leaders.length === 0 && <Leader rank={1} name="—" amount="—" />}
              </div>

              <div className="mt-4 text-xs text-white/50">Agency leaderboard (AP).</div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="mt-6 glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Recent Activity</h2>
              <span className="text-xs text-white/60">Latest submissions</span>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <Row head left="Agent" mid="AP" right="By the hour" />
              {(loading ? [] : parsed.slice(0, 6)).map((d) => (
                <Row key={d.id} left={welcomeName} mid={`$${formatMoney(d.apNum)}`} right={timeAgo(d.dt)} />
              ))}
              {!loading && parsed.length === 0 && <Row left="—" mid="No deals yet" right="—" />}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

/* ---------------- helpers ---------------- */

function sumAP(rows: any[]) {
  return rows.reduce((s, d) => s + Number(d.apNum || 0), 0)
}

function KPI({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-white/60">{title}</p>
      <div className="mt-2">
        <span className="text-3xl font-semibold">{value}</span>
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
            highlight ? 'bg-[var(--accent)]' : 'bg-white/10'
          }`}
          style={highlight ? ({ color: 'var(--accentText)' } as any) : undefined}
        >
          {rank}
        </div>
        <div>
          <div className={`${highlight ? 'text-base font-semibold' : 'text-sm font-medium'}`}>{name}</div>
          <div className="text-xs text-white/50">Monthly production (AP)</div>
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

function formatMoney(n: number) {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// typing helpers
function moneyInput(v: string) {
  const cleaned = String(v || '').replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
}

function toMoneyNumber(v: string) {
  const num = Number(String(v || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : NaN
}

/* ---------------- goals donuts (live color) ---------------- */

function GoalDonutsLive({
  weeklyCurrentAP,
  weeklyGoalAP,
  monthlyCurrentAP,
  monthlyGoalAP,
}: {
  weeklyCurrentAP: number
  weeklyGoalAP: number
  monthlyCurrentAP: number
  monthlyGoalAP: number
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GoalRing
        title="Weekly Goal"
        current={weeklyCurrentAP}
        goal={weeklyGoalAP}
        subtitle={`${pct(weeklyCurrentAP, weeklyGoalAP)}% • $${formatMoney(weeklyCurrentAP)} / $${formatMoney(weeklyGoalAP)}`}
      />
      <GoalRing
        title="Monthly Goal"
        current={monthlyCurrentAP}
        goal={monthlyGoalAP}
        subtitle={`${pct(monthlyCurrentAP, monthlyGoalAP)}% • $${formatMoney(monthlyCurrentAP)} / $${formatMoney(monthlyGoalAP)}`}
      />
    </div>
  )
}

function GoalRing({ title, current, goal, subtitle }: { title: string; current: number; goal: number; subtitle: string }) {
  const p = clamp01(goal > 0 ? current / goal : 0)
  const stroke = ringColor(p)
  const r = 42
  const c = 2 * Math.PI * r
  const dash = c * p

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-4">
      <div className="relative" style={{ width: 104, height: 104 }}>
        <svg width="104" height="104" viewBox="0 0 104 104">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="52" cy="52" r={r} stroke="rgba(255,255,255,0.10)" strokeWidth="10" fill="none" />

          <circle
            cx="52"
            cy="52"
            r={r}
            stroke={stroke}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform="rotate(-90 52 52)"
            style={{ transition: 'stroke-dasharray 400ms ease, stroke 200ms ease' }}
            filter="url(#glow)"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm font-semibold">{pct(current, goal)}%</div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-white/60 mt-1">{subtitle}</div>
      </div>
    </div>
  )
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function pct(current: number, goal: number) {
  if (!goal || goal <= 0) return 0
  const p = (current / goal) * 100
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(999, Math.round(p)))
}

function ringColor(p: number) {
  // red -> orange -> yellow -> green
  if (p >= 1) return '#22c55e' // green
  if (p >= 0.66) return '#facc15' // yellow
  if (p >= 0.33) return '#fb923c' // orange
  return '#ef4444' // red
}

/* ---------------- UI bits ---------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function GlassEditIcon() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-xl border border-white/10 bg-white/5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 20h9"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'

const saveWide =
  'mt-5 w-full rounded-2xl bg-[var(--accent)] hover:opacity-90 transition px-4 py-3 text-sm font-semibold'

