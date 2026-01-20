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
  upline_id?: string | null
  avatar_url?: string | null
}

type LeaderRow = {
  user_id: string
  name: string
  ap: number
  avatar_url?: string | null
}

type UserGoals = {
  weekly_goal_ap: number
  monthly_goal_ap: number
}

type Notif = {
  id: string
  title: string
  body?: string
  ts: Date
  kind: 'followup' | 'deal' | 'goal' | 'system'
  href?: string
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
  const [goalW, setGoalW] = useState('2,500.00')
  const [goalM, setGoalM] = useState('10,000.00')

  // ✅ Notifications
  const [notifOpen, setNotifOpen] = useState(false)

  // ✅ Light/Dark toggle (UI-only; doesn’t change existing theme tokens)
  const [darkMode, setDarkMode] = useState<boolean>(true)

  // ✅ Date selector (thin, sleek) for chart + KPI scope
  const [dateOpen, setDateOpen] = useState(false)
  const [rangeStart, setRangeStart] = useState<string>('') // YYYY-MM-DD
  const [rangeEnd, setRangeEnd] = useState<string>('') // YYYY-MM-DD

  // ✅ Downlines/team scope
  const [teamIds, setTeamIds] = useState<string[] | null>(null)

  useEffect(() => {
    // load UI prefs
    try {
      const raw = localStorage.getItem('flow_dark')
      const next = raw ? raw === '1' : true
      setDarkMode(next)
      setHtmlDark(next)
    } catch {
      setHtmlDark(true)
    }
  }, [])

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

      // Set default date range = this month (matches current behavior)
      const now = new Date()
      const ms = new Date(now.getFullYear(), now.getMonth(), 1)
      const meIso = toYMD(now)
      const msIso = toYMD(ms)
      setRangeStart(msIso)
      setRangeEnd(meIso)

      const isOwnerOrAdmin = !!(profile && (profile.role === 'admin' || profile.is_agency_owner))

      // ✅ Build teamIds for non-admin users (so "agents with downlines show team production")
      let computedTeamIds: string[] = [user.id]
      try {
        computedTeamIds = await buildTeamIds(user.id)
      } catch {
        computedTeamIds = [user.id]
      }
      if (!alive) return
      setTeamIds(computedTeamIds)

      // Deals feed:
      // - admin/owner: all (unchanged)
      // - non-admin with downlines: team
      // - solo agent: own
      const base = supabase
        .from('deals')
        .select('id,user_id,created_at,premium,company')
        .order('created_at', { ascending: false })
        .limit(2000)

      const hasDownlines = computedTeamIds.length > 1
      const { data, error } = isOwnerOrAdmin
        ? await base
        : hasDownlines
        ? await base.in('user_id', computedTeamIds)
        : await base.eq('user_id', user.id)

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

  async function buildTeamIds(rootId: string) {
    // Pull all profiles (id,upline_id) and build a simple graph
    const { data, error } = await supabase.from('profiles').select('id,upline_id').limit(50000)
    if (error || !data) return [rootId]

    const children = new Map<string, string[]>()
    ;(data as any[]).forEach((p) => {
      const up = p.upline_id || null
      if (!up) return
      if (!children.has(up)) children.set(up, [])
      children.get(up)!.push(p.id)
    })

    const out: string[] = []
    const q: string[] = [rootId]
    const seen = new Set<string>()

    // BFS (includes root)
    while (q.length) {
      const cur = q.shift()!
      if (seen.has(cur)) continue
      seen.add(cur)
      out.push(cur)
      const kids = children.get(cur) || []
      kids.forEach((k) => q.push(k))
      if (out.length > 2500) break // safety
    }
    return out
  }

  async function loadGoals(uid: string) {
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
        setGoalW(formatMoneyInput(next.weekly_goal_ap))
        setGoalM(formatMoneyInput(next.monthly_goal_ap))
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
        setGoalW(formatMoneyInput(next.weekly_goal_ap))
        setGoalM(formatMoneyInput(next.monthly_goal_ap))
        return
      }
    } catch {}

    setGoals({ weekly_goal_ap: 2500, monthly_goal_ap: 10000 })
    setGoalW(formatMoneyInput(2500))
    setGoalM(formatMoneyInput(10000))
  }

  async function saveGoals() {
    if (!me?.id) return
    if (goalsSaving) return
    setGoalsSaving(true)
    try {
      const w = parseMoneyInput(goalW)
      const m = parseMoneyInput(goalM)
      const next = {
        weekly_goal_ap: Number.isFinite(w) && w > 0 ? w : 2500,
        monthly_goal_ap: Number.isFinite(m) && m > 0 ? m : 10000,
      }

      try {
        const res = await supabase.from('user_goals').upsert(
          { user_id: me.id, weekly_goal_ap: next.weekly_goal_ap, monthly_goal_ap: next.monthly_goal_ap },
          { onConflict: 'user_id' }
        )
        if (!res.error) {
          setGoals(next)
          setGoalW(formatMoneyInput(next.weekly_goal_ap))
          setGoalM(formatMoneyInput(next.monthly_goal_ap))
          setGoalsOpen(false)
          return
        }
      } catch {}

      localStorage.setItem(`flow_goals_${me.id}`, JSON.stringify(next))
      setGoals(next)
      setGoalW(formatMoneyInput(next.weekly_goal_ap))
      setGoalM(formatMoneyInput(next.monthly_goal_ap))
      setGoalsOpen(false)
    } finally {
      setGoalsSaving(false)
    }
  }

  async function buildAgencyLeaders(): Promise<LeaderRow[]> {
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

    // ✅ also fetch avatar_url
    const { data: ps } = await supabase.from('profiles').select('id,first_name,last_name,email,avatar_url').in('id', ids)

    const pmap = new Map<string, any>()
    ;(ps || []).forEach((p: any) => pmap.set(p.id, p))

    return top.map(([uid, ap]) => {
      const p = pmap.get(uid)
      const name =
        [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
        (p?.email ? String(p.email).split('@')[0] : '—')
      return { user_id: uid, name, ap, avatar_url: p?.avatar_url || null }
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

  // ✅ Date-range filtering (default: month-to-date so behavior matches current)
  const rangeStartDt = useMemo(() => (rangeStart ? new Date(rangeStart + 'T00:00:00') : monthStart), [rangeStart, monthStart])
  const rangeEndDt = useMemo(() => {
    if (!rangeEnd) return now
    const e = new Date(rangeEnd + 'T23:59:59')
    return e
  }, [rangeEnd, now])

  const rangeDeals = useMemo(
    () => parsed.filter((d) => d.dt >= rangeStartDt && d.dt <= rangeEndDt),
    [parsed, rangeStartDt, rangeEndDt]
  )

  const todayDeals = useMemo(() => parsed.filter((d) => d.dt >= todayStart), [parsed, todayStart])
  const weekDeals = useMemo(() => parsed.filter((d) => d.dt >= weekStart), [parsed, weekStart])
  const monthDeals = useMemo(() => parsed.filter((d) => d.dt >= monthStart), [parsed, monthStart])

  // ✅ Production (AP) card rules:
  // - solo agent: personal only (already enforced by deals query)
  // - agent with downlines: team (enforced by deals query)
  // - owner/admin: all (unchanged)
  const production = useMemo(() => sumAP(monthDeals), [monthDeals])

  const writingAgents = useMemo(() => {
    const uniq = new Set(monthDeals.map((d) => d.user_id).filter(Boolean) as string[])
    return uniq.size
  }, [monthDeals])

  const dealsSubmitted = useMemo(() => monthDeals.length, [monthDeals])

  // ✅ Flow trend uses rangeDeals so selector reflects submitted data
  const last7 = useMemo(() => {
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStart = startOfDay(d)
      const next = new Date(dStart)
      next.setDate(dStart.getDate() + 1)

      const count = rangeDeals.filter((x) => x.dt >= dStart && x.dt < next).length
      const label = d.toLocaleDateString(undefined, { weekday: 'short' })
      days.push({ label, count })
    }
    return days
  }, [rangeDeals, now])

  const lineLabels = useMemo(() => last7.map((x) => x.label), [last7])
  const lineValues = useMemo(() => last7.map((x) => x.count), [last7])

  // ✅ donut uses rangeDeals (selector)
  const carrierDist = useMemo(() => {
    const map = new Map<string, number>()
    rangeDeals.forEach((d) => map.set(d.companySafe, (map.get(d.companySafe) || 0) + 1))
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const labels = entries.length ? entries.map((e) => e[0]) : ['No Data']
    const values = entries.length ? entries.map((e) => e[1]) : [100]
    return { labels, values }
  }, [rangeDeals])

  const todayAP = useMemo(() => sumAP(todayDeals), [todayDeals])
  const weekAP = useMemo(() => sumAP(weekDeals), [weekDeals])
  const monthAP = useMemo(() => sumAP(monthDeals), [monthDeals])

  // ✅ Notifications derived from what you already have (deals + goals).
  // If you add a follow_ups table later, it will plug into this array.
  const notifications = useMemo<Notif[]>(() => {
    const list: Notif[] = []

    // recent deals (last 24h)
    const last24 = parsed.filter((d) => Date.now() - d.dt.getTime() <= 24 * 60 * 60 * 1000)
    if (last24.length) {
      list.push({
        id: 'deals_24h',
        kind: 'deal',
        title: `${last24.length} new deal${last24.length === 1 ? '' : 's'} in the last 24h`,
        body: 'Keep the momentum.',
        ts: new Date(),
        href: '/post-deal',
      })
    }

    // weekly goal reached
    if (goals.weekly_goal_ap > 0 && weekAP >= goals.weekly_goal_ap) {
      list.push({
        id: 'goal_week',
        kind: 'goal',
        title: 'Weekly goal reached 🎯',
        body: `$${formatMoney(weekAP)} AP / $${formatMoney(goals.weekly_goal_ap)} AP`,
        ts: new Date(),
      })
    }

    // monthly goal reached
    if (goals.monthly_goal_ap > 0 && monthAP >= goals.monthly_goal_ap) {
      list.push({
        id: 'goal_month',
        kind: 'goal',
        title: 'Monthly goal reached 🏆',
        body: `$${formatMoney(monthAP)} AP / $${formatMoney(goals.monthly_goal_ap)} AP`,
        ts: new Date(),
      })
    }

    // placeholder followups (until you wire your followups source)
    list.push({
      id: 'followups_stub',
      kind: 'followup',
      title: 'Follow-ups',
      body: 'Connect follow-ups feed (table/API) to show due items here.',
      ts: new Date(Date.now() - 15 * 60 * 1000),
    })

    return list
      .slice()
      .sort((a, b) => b.ts.getTime() - a.ts.getTime())
      .slice(0, 8)
  }, [parsed, goals.weekly_goal_ap, goals.monthly_goal_ap, weekAP, monthAP])

  const notifCount = notifications.length

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
                  onChange={(e) => setGoalW(moneyInputLocked(e.target.value))}
                  onBlur={() => setGoalW(formatMoneyInput(parseMoneyInput(goalW)))}
                  placeholder="2,500.00"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Monthly Goal (AP)">
                <input
                  className={inputCls}
                  value={goalM}
                  onChange={(e) => setGoalM(moneyInputLocked(e.target.value))}
                  onBlur={() => setGoalM(formatMoneyInput(parseMoneyInput(goalM)))}
                  placeholder="10,000.00"
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
            {/* ✅ Light/Dark toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !darkMode
                setDarkMode(next)
                try {
                  localStorage.setItem('flow_dark', next ? '1' : '0')
                } catch {}
                setHtmlDark(next)
              }}
              className="glass px-3 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10 inline-flex items-center gap-2"
              title="Toggle light/dark"
            >
              <ModeIcon />
              {darkMode ? 'Dark' : 'Light'}
            </button>

            {/* ✅ Notifications dropdown (top right) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="glass px-3 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10 inline-flex items-center gap-2"
                title="Notifications"
              >
                <BellIcon />
                <span className="hidden sm:inline">Notifications</span>
                {notifCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-[var(--accent)] text-[var(--accentText)] text-[11px] font-bold">
                    {notifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-24px)] z-[300] rounded-2xl border border-white/10 bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="text-sm font-semibold">Notifications</div>
                    <button className="text-xs text-white/60 hover:text-white" onClick={() => setNotifOpen(false)}>
                      Close
                    </button>
                  </div>

                  <div className="max-h-[420px] overflow-auto">
                    {notifications.map((n) => (
                      <a
                        key={n.id}
                        href={n.href || '#'}
                        onClick={(e) => {
                          if (!n.href || n.href === '#') e.preventDefault()
                          setNotifOpen(false)
                        }}
                        className="block px-4 py-3 border-b border-white/10 hover:bg-white/5 transition"
                      >
                        <div className="flex items-start gap-3">
                          <NotifDot kind={n.kind} />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{n.title}</div>
                            {n.body && <div className="text-xs text-white/60 mt-1">{n.body}</div>}
                            <div className="text-[11px] text-white/45 mt-2">{timeAgo(n.ts)}</div>
                          </div>
                        </div>
                      </a>
                    ))}
                    {notifications.length === 0 && <div className="px-4 py-6 text-sm text-white/60">No notifications.</div>}
                  </div>
                </div>
              )}
            </div>

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
            <MiniStat
              label={
                me?.role === 'admin' || me?.is_agency_owner
                  ? 'Production (AP)'
                  : teamIds && teamIds.length > 1
                  ? 'Team Production (AP)'
                  : 'My Production (AP)'
              }
              value={loading ? '—' : `$${formatMoney(production)}`}
            />
            <MiniStat label="Writing Agents" value={loading ? '—' : String(writingAgents)} />
            <MiniStat label="Deals Submitted" value={loading ? '—' : String(dealsSubmitted)} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Flow Trend</h2>
                <span className="text-xs text-white/60">Last 7 days</span>
              </div>

              {/* ✅ Clickable + hover-ready (FlowLineChart patch below supports this) */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 cursor-pointer">
                <FlowLineChart labels={lineLabels} values={lineValues} interactive />
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

              {/* ✅ KPI row with sleek date selector on the right */}
              <div className="flex items-center justify-between mt-6 mb-3">
                <div className="text-sm font-semibold text-white/80">Production</div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDateOpen((v) => !v)}
                    className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs font-semibold inline-flex items-center gap-2"
                    title="Select date range"
                  >
                    <CalendarIcon />
                    <span className="text-white/70">
                      {rangeStart || toYMD(monthStart)} → {rangeEnd || toYMD(now)}
                    </span>
                  </button>

                  {dateOpen && (
                    <div className="absolute right-0 mt-2 z-[260] w-[340px] rounded-2xl border border-white/10 bg-[var(--card)]/95 backdrop-blur-xl shadow-2xl p-4">
                      <div className="text-sm font-semibold mb-3">Date Range</div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-[11px] text-white/55 mb-2">Start</div>
                          <input
                            type="date"
                            className={inputCls}
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                          />
                        </div>

                        <div>
                          <div className="text-[11px] text-white/55 mb-2">End</div>
                          <input
                            type="date"
                            className={inputCls}
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <button
                            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs font-semibold"
                            onClick={() => {
                              const n = new Date()
                              setRangeStart(toYMD(new Date(n.getFullYear(), n.getMonth(), 1)))
                              setRangeEnd(toYMD(n))
                              setDateOpen(false)
                            }}
                          >
                            Month-to-date
                          </button>

                          <button
                            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs font-semibold"
                            onClick={() => setDateOpen(false)}
                          >
                            Done
                          </button>
                        </div>

                        <div className="text-[11px] text-white/45">
                          This selector drives the Flow Trend + donut distribution (rangeDeals).
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              {/* ✅ donut gets same glow / glass effect as goals donuts (CarrierDonut patch below supports glow) */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-5">
                <CarrierDonut labels={carrierDist.labels} values={carrierDist.values} glow />
              </div>

              <div className="space-y-3">
                {(loading ? [] : leaders).map((l, idx) => (
                  <Leader
                    key={l.user_id}
                    rank={idx + 1}
                    name={l.name}
                    amount={`$${formatMoney(l.ap)}`}
                    avatar_url={l.avatar_url}
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
  avatar_url,
  highlight,
}: {
  rank: number
  name: string
  amount: string
  avatar_url?: string | null
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 ${
        highlight ? 'bg-white/10' : 'bg-white/5'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* ✅ profile picture */}
        <div className="w-9 h-9 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
          {avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-white/60">{(name || 'A').slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0">
          <div className={`${highlight ? 'text-base font-semibold' : 'text-sm font-medium'} truncate`}>{name}</div>
          <div className="text-xs text-white/50">Monthly production (AP)</div>
        </div>
      </div>

      <div className={`${highlight ? 'text-lg font-semibold' : 'text-sm font-semibold'} text-green-400`}>{amount}</div>
    </div>
  )
}

function Row({ head, left, mid, right }: { head?: boolean; left: string; mid: string; right: string }) {
  return (
    <div className={`grid grid-cols-3 px-4 py-3 border-b border-white/10 ${head ? 'text-xs text-white/60 bg-white/5' : 'text-sm'}`}>
      <div>{left}</div>
      <div className="text-center">{mid}</div>
      <div className="text-right">{right}</div>
    </div>
  )
}

function timeAgo(d: Date) {
  const dt = d instanceof Date ? d : new Date(d)
  const diff = Date.now() - dt.getTime()
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

function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* -------- locked financial inputs (commas + decimals) -------- */

// Allow only digits and one dot, max 2 decimals, but keep commas display-friendly
function moneyInputLocked(v: string) {
  const raw = String(v || '').replace(/,/g, '')
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  const a = parts[0] || ''
  const b = (parts[1] || '').slice(0, 2)
  const joined = parts.length > 1 ? `${a}.${b}` : a
  // don’t force formatting while typing too aggressively; keep readable
  return joined
}

// ✅ CONTINUE FROM: function parseMoneyInput(v: string) {

function parseMoneyInput(v: string) {
  const num = Number(String(v || '').replace(/,/g, '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : NaN
}

function formatMoneyInput(n: number) {
  const num = Number(n || 0)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
        subtitle={`${pct(weeklyCurrentAP, weeklyGoalAP)}% • $${formatMoney(weeklyCurrentAP)} / $${formatMoney(
          weeklyGoalAP
        )}`}
      />
      <GoalRing
        title="Monthly Goal"
        current={monthlyCurrentAP}
        goal={monthlyGoalAP}
        subtitle={`${pct(monthlyCurrentAP, monthlyGoalAP)}% • $${formatMoney(monthlyCurrentAP)} / $${formatMoney(
          monthlyGoalAP
        )}`}
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
  if (p >= 1) return '#22c55e'
  if (p >= 0.66) return '#facc15'
  if (p >= 0.33) return '#fb923c'
  return '#ef4444'
}

/* ---------------- Notifications UI bits ---------------- */

function NotifDot({ kind }: { kind: Notif['kind'] }) {
  const cls =
    kind === 'goal'
      ? 'bg-green-500/30 border-green-400/20'
      : kind === 'deal'
      ? 'bg-blue-500/30 border-blue-400/20'
      : kind === 'followup'
      ? 'bg-yellow-500/30 border-yellow-400/20'
      : 'bg-white/10 border-white/10'

  return <span className={`mt-1 w-3 h-3 rounded-full border ${cls}`} />
}

/* ---------------- Icons ---------------- */

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 17H9"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3v3M17 3v3"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 8h16"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 6h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2Z"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ModeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a7 7 0 000 14 7 7 0 007-7"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 3v4h-4"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GlassEditIcon() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-xl border border-white/10 bg-white/5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 20h9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" />
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

/* ---------------- Dark mode (UI-only) ---------------- */

function setHtmlDark(isDark: boolean) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (isDark) el.classList.add('dark')
  else el.classList.remove('dark')
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

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'

const saveWide =
  'mt-5 w-full rounded-2xl bg-[var(--accent)] hover:opacity-90 transition px-4 py-3 text-sm font-semibold'
