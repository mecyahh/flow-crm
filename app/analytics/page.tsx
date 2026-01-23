// /app/analytics/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import FlowDatePicker from '@/app/components/FlowDatePicker'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_agency_owner: boolean | null
}

type DealRow = {
  id: string
  created_at: string
  agent_id: string | null
  premium: any
  company: string | null
}

type ParsedDeal = DealRow & {
  dt: Date
  premiumNum: number
  apNum: number
  companySafe: string
  agentSafe: string
}

const WEEKLY_UNDER_AP = 5000

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

   const [me, setMe] = useState<Profile | null>(null)
  const [agents, setAgents] = useState<Profile[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])

  // ✅ For non-admins: show my analytics + downlines (team scope)
  const [teamIds, setTeamIds] = useState<string[] | null>(null)

  // ✅ Collapsible cards
  const [underOpen, setUnderOpen] = useState(false)
  const [nonWritersOpen, setNonWritersOpen] = useState(false)

  // Range (single global range controls EVERYTHING)
  const [rangeMode, setRangeMode] = useState<'this_week' | 'last_7' | 'this_month' | 'custom'>('this_week')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  // keep range synced w/ presets
  useEffect(() => {
    const now = new Date()
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const startOfWeek = (d: Date) => {
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const base = new Date(d)
      base.setDate(d.getDate() + diff)
      return startOfDay(base)
    }
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

    if (rangeMode === 'custom') return

    let s = new Date()
    let e = new Date()
    if (rangeMode === 'this_week') {
      s = startOfWeek(now)
      e = new Date(startOfDay(now))
      e.setDate(e.getDate() + 1) // exclusive end (tomorrow 00:00)
    } else if (rangeMode === 'last_7') {
      e = new Date(startOfDay(now))
      e.setDate(e.getDate() + 1)
      s = new Date(e)
      s.setDate(s.getDate() - 7)
    } else {
      s = startOfMonth(now)
      e = new Date(startOfDay(now))
      e.setDate(e.getDate() + 1)
    }

    setRangeStart(toISODate(s))
    setRangeEnd(toISODate(e))
  }, [rangeMode])

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!me) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.role, me?.is_agency_owner, rangeStart, rangeEnd])

  async function boot() {
    setLoading(true)

    const { data: userRes, error: userErr } = await supabase.auth.getUser()
    const user = userRes.user
    if (userErr || !user) {
      window.location.href = '/login'
      return
    }

    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name,role,is_agency_owner')
      .eq('id', user.id)
      .single()

    if (pErr || !prof) {
      setToast('Could not load profile (RLS?)')
      setLoading(false)
      return
    }

    setMe(prof as Profile)
    setLoading(false)
  }

  async function loadData() {
    if (!me) return
    setLoading(true)
    setToast(null)

    const isTeam = (me.is_agency_owner || me.role === 'admin') === true

    // Load full directory (we need upline graph even for agents)
    const { data: aData, error: aErr } = await supabase
      .from('profiles')
      .select('id,email,first_name,last_name,role,is_agency_owner,upline_id')
      .order('created_at', { ascending: false })
      .limit(50000)

    const directory = (!aErr && aData ? (aData as any[]) : []) as any[]

    // ✅ Build team scope for non-admins: me + downlines (BFS)
    let computedTeamIds: string[] = me.id ? [me.id] : []
    if (!isTeam && me.id) {
      try {
        computedTeamIds = buildTeamIdsFromDirectory(me.id, directory)
      } catch {
        computedTeamIds = [me.id]
      }
    }

    setTeamIds(isTeam ? null : computedTeamIds)

    // ✅ Agents list in UI:
    // - admins: full directory
    // - agents: only me + downlines
    const filteredAgents = isTeam
      ? directory
      : directory.filter((p) => computedTeamIds.includes(String(p.id)))

    setAgents(filteredAgents as any)

    // Deals
    const q = supabase
      .from('deals')
      .select('id,created_at,agent_id,premium,company')
      .gte('created_at', rangeStart ? new Date(rangeStart).toISOString() : '1900-01-01T00:00:00.000Z')
      .lt('created_at', rangeEnd ? new Date(rangeEnd).toISOString() : '2999-12-31T00:00:00.000Z')
      .order('created_at', { ascending: true })
      .limit(20000)

    const { data: dData, error: dErr } = isTeam
      ? await q
      : computedTeamIds.length > 0
        ? await q.in('agent_id', computedTeamIds)
        : await q.eq('agent_id', me.id)

    if (dErr) {
      setDeals([])
      setToast('Could not load deals (RLS?)')
      setLoading(false)
      return
    }

    setDeals((dData || []) as DealRow[])
    setLoading(false)
  }

  const agentsById = useMemo(() => {
    const m = new Map<string, Profile>()
    agents.forEach((a) => m.set(a.id, a))
    return m
  }, [agents])

  const parsed = useMemo((): ParsedDeal[] => {
    return deals.map((d) => {
      const dt = d.created_at ? new Date(d.created_at) : new Date()
      const premiumNum =
        typeof d.premium === 'number'
          ? d.premium
          : typeof d.premium === 'string'
          ? Number(d.premium.replace(/[^0-9.]/g, ''))
          : Number(d.premium || 0)

      const p = Number.isFinite(premiumNum) ? premiumNum : 0
      const companySafe = (d.company || 'Other').trim() || 'Other'

      const prof = d.agent_id ? agentsById.get(d.agent_id) : null
      const agentSafe = prof ? displayName(prof) : d.agent_id ? 'Agent' : '—'

            const apNum = p * 12

      return {
        ...d,
        dt,
        premiumNum: p,
        apNum,
        companySafe,
        agentSafe,
      }
    })
  }, [deals, agentsById])

    // ✅ KPIs
  // - Total AP uses *12 rule
  // - Avg Premium / Deal uses raw premium (NOT annualized)
  const totalAP = useMemo(() => parsed.reduce((s, d) => s + d.apNum, 0), [parsed])
  const totalPremium = useMemo(() => parsed.reduce((s, d) => s + d.premiumNum, 0), [parsed])

  const dealsCount = parsed.length
  const avgPremiumPerDeal = dealsCount ? totalPremium / dealsCount : 0

  // per-agent aggregation (even for agent view, still useful)
  const perAgent = useMemo(() => {
    const map = new Map<
      string,
      { agent_id: string; name: string; ap: number; deals: number; dts: number[] }
    >()

    parsed.forEach((d) => {
      const aid = d.agent_id || 'unknown'
      const name = d.agent_id ? (agentsById.get(d.agent_id) ? displayName(agentsById.get(d.agent_id)!) : d.agentSafe) : '—'
      if (!map.has(aid)) map.set(aid, { agent_id: aid, name, ap: 0, deals: 0, dts: [] })
      const row = map.get(aid)!
      row.ap += d.apNum
      row.deals += 1
      row.dts.push(d.dt.getTime())
    })

    const rows = Array.from(map.values()).map((r) => {
      r.dts.sort((a, b) => a - b)
      const diffs: number[] = []
      for (let i = 1; i < r.dts.length; i++) diffs.push(r.dts[i] - r.dts[i - 1])
      const avgMs = diffs.length ? diffs.reduce((s, x) => s + x, 0) / diffs.length : 0
      return {
        ...r,
        avgGapMs: avgMs,
        avgAP: r.deals ? r.ap / r.deals : 0,
      }
    })

    rows.sort((a, b) => b.ap - a.ap)
    return rows
  }, [parsed, agentsById])

  const avgAPPerAgent = useMemo(() => {
    const active = perAgent.filter((a) => a.deals > 0)
    if (!active.length) return 0
    return active.reduce((s, a) => s + a.avgAP, 0) / active.length
  }, [perAgent])

  const avgTimeBetweenDeals = useMemo(() => {
    const with2 = perAgent.filter((a) => a.deals >= 2 && a.avgGapMs > 0)
    if (!with2.length) return 0
    return with2.reduce((s, a) => s + a.avgGapMs, 0) / with2.length
  }, [perAgent])

  const under5kAgents = useMemo(() => {
    return perAgent
      .filter((a) => a.agent_id !== 'unknown' && a.ap < WEEKLY_UNDER_AP)
      .slice()
      .sort((a, b) => a.ap - b.ap)
  }, [perAgent])

  const nonWriters = useMemo(() => {
    // agency directory minus anyone with deals in range
    const activeIds = new Set(perAgent.filter((a) => a.deals > 0).map((a) => a.agent_id))
    const list = agents
      .filter((a) => !activeIds.has(a.id))
      .map((a) => ({
        id: a.id,
        name: displayName(a),
        email: a.email || '',
      }))
      .sort((x, y) => x.name.localeCompare(y.name))
    return list
  }, [agents, perAgent])

    // Top Carrier
  const topCarrier = useMemo(() => {
    const m = new Map<string, number>()
    parsed.forEach((d) => m.set(d.companySafe, (m.get(d.companySafe) || 0) + d.premiumNum))

    let best = '—'
    let bestVal = 0
    for (const [k, v] of m.entries()) {
      if (v > bestVal) {
        best = k
        bestVal = v
      }
    }
    return bestVal ? best : '—'
  }, [parsed])

  // Trend (daily AP)
  const dailyAP = useMemo(() => {
    const start = rangeStart ? new Date(rangeStart) : new Date()
    const end = rangeEnd ? new Date(rangeEnd) : new Date()
    const days = clampDays(diffDays(start, end), 1, 62)

    const out: { label: string; ap: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const key = toISODate(d)
      out.push({ label: key, ap: 0 })
    }

    const idx = new Map<string, number>()
    out.forEach((x, i) => idx.set(x.label, i))

    parsed.forEach((d) => {
      const k = toISODateLocal(d.dt)
      const i = idx.get(k)
      if (i !== undefined) out[i].ap += d.premiumNum
    })

    return out
  }, [parsed, rangeStart, rangeEnd])

  const trendMax = useMemo(() => Math.max(1, ...dailyAP.map((x) => x.ap)), [dailyAP])

  // Carrier breakdown
  const byCarrier = useMemo(() => {
    const m = new Map<string, { carrier: string; ap: number; deals: number }>()
    parsed.forEach((d) => {
      const k = d.companySafe
      if (!m.has(k)) m.set(k, { carrier: k, ap: 0, deals: 0 })
      const r = m.get(k)!
      r.ap += d.premiumNum
      r.deals += 1
    })
    return Array.from(m.values()).sort((a, b) => b.ap - a.ap)
  }, [parsed])
  
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
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
            <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-sm text-white/60 mt-1">Custom range for everything • clean signal.</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => loadData()} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        {/* RANGE */}
        <div className="glass rounded-2xl border border-white/10 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Date Range</div>
              <div className="text-xs text-white/55 mt-1">Applies to all analytics on this page.</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['this_week', 'last_7', 'this_month', 'custom'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeMode(k)}
                  className={[
                    'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                    rangeMode === k ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
                  ].join(' ')}
                >
                  {k === 'this_week'
                    ? 'This Week'
                    : k === 'last_7'
                    ? 'Last 7'
                    : k === 'this_month'
                    ? 'This Month'
                    : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-white/55 mb-2">Start</div>
              <FlowDatePicker value={rangeStart} onChange={setRangeStart} placeholder="Start date" />
            </div>
            <div>
              <div className="text-[11px] text-white/55 mb-2">End (exclusive)</div>
              <FlowDatePicker value={rangeEnd} onChange={setRangeEnd} placeholder="End date" />
              <div className="text-[11px] text-white/50 mt-2">Tip: end is exclusive (set to tomorrow for “through today”).</div>
            </div>
          </div>
        </div>

        {/* TOP KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <MiniStat label="Total AP" value={loading ? '—' : `$${formatMoney2(totalAP)}`} />
          <MiniStat label="Deals Submitted" value={loading ? '—' : String(dealsCount)} />
          <MiniStat label="Avg Premium / Deal" value={loading ? '—' : `$${formatMoney2(avgPremiumPerDeal)}`} />
          <MiniStat label="Top Carrier" value={loading ? '—' : topCarrier} />
        </section>

        {/* ADVANCED KPIs */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold">Average time between deals</div>
            <div className="text-xs text-white/55 mt-1">Average gap between consecutive deal submissions.</div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Avg gap</div>
              <div className="mt-1 text-3xl font-semibold">{loading ? '—' : humanGap(avgTimeBetweenDeals)}</div>
            </div>
          </div>

          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold">Average AP per agent</div>
            <div className="text-xs text-white/55 mt-1">Average of each agent’s AP per deal (active agents).</div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Avg</div>
              <div className="mt-1 text-3xl font-semibold">{loading ? '—' : `$${formatMoney2(avgAPPerAgent)}`}</div>
            </div>
          </div>

                    <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Agents under ${formatMoney2(WEEKLY_UNDER_AP)} AP</div>
                <div className="text-xs text-white/55 mt-1">In the selected range.</div>
              </div>

              <button
                type="button"
                onClick={() => setUnderOpen((s) => !s)}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs font-semibold"
              >
                {underOpen ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {!underOpen ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                {loading ? '—' : `${under5kAgents.length} agent${under5kAgents.length === 1 ? '' : 's'} under threshold`}
              </div>
            ) : (
              <>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <Row head left="Agent" mid="AP" right="Deals" />
                  {(loading ? [] : under5kAgents.slice(0, 10)).map((a) => (
                    <Row key={a.agent_id} left={a.name} mid={`$${formatMoney2(a.ap)}`} right={String(a.deals)} dangerMid />
                  ))}
                  {!loading && under5kAgents.length === 0 && <Row left="—" mid="None ✅" right="—" />}
                </div>

                <div className="mt-3 text-[11px] text-white/50">Shows bottom performers first.</div>
              </>
            )}
          </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <Row head left="Agent" mid="AP" right="Deals" />
              {(loading ? [] : under5kAgents.slice(0, 10)).map((a) => (
                <Row key={a.agent_id} left={a.name} mid={`$${formatMoney2(a.ap)}`} right={String(a.deals)} dangerMid />
              ))}
              {!loading && under5kAgents.length === 0 && <Row left="—" mid="None ✅" right="—" />}
            </div>

            <div className="mt-3 text-[11px] text-white/50">Shows bottom performers first.</div>
          </div>
        </section>

        {/* TREND + BREAKDOWNS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Daily AP Trend</h2>
              <span className="text-xs text-white/60">{rangeStart} → {rangeEnd}</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
              <MiniAreaChart data={dailyAP.map((x) => x.ap)} max={trendMax} />
              <div className="mt-3 grid grid-cols-4 md:grid-cols-8 gap-2 text-[11px] text-white/45">
                {dailyAP.slice(Math.max(0, dailyAP.length - 8)).map((x) => (
                  <div key={x.label} className="truncate">
                    {x.label.slice(5)}: <span className="text-white/70">${formatMoney2(x.ap)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-base font-semibold mb-4">By Carrier</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <Row head left="Carrier" mid="AP" right="Deals" />
              {(loading ? [] : byCarrier.slice(0, 10)).map((c) => (
                <Row key={c.carrier} left={c.carrier} mid={`$${formatMoney2(c.ap)}`} right={String(c.deals)} />
              ))}
              {!loading && byCarrier.length === 0 && <Row left="—" mid="No data" right="—" />}
            </div>
          </div>
        </section>

                  <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Non Writers</h2>
              <div className="text-xs text-white/55 mt-1">Agents with 0 deals in the selected range.</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-white/60">
                Total: <span className="text-white font-semibold">{loading ? '—' : nonWriters.length}</span>
              </div>

              <button
                type="button"
                onClick={() => setNonWritersOpen((s) => !s)}
                className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs font-semibold"
              >
                {nonWritersOpen ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {!nonWritersOpen ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              {loading ? '—' : `Showing collapsed • ${nonWriters.length} non-writer${nonWriters.length === 1 ? '' : 's'}`}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <Row head left="Agent" mid="Email" right="Status" />
                {(loading ? [] : nonWriters.slice(0, 40)).map((n) => (
                  <Row key={n.id} left={n.name} mid={n.email || '—'} right="0 deals" dangerRight />
                ))}
                {!loading && nonWriters.length === 0 && <Row left="—" mid="Everyone wrote ✅" right="—" />}
              </div>

              <div className="mt-3 text-[11px] text-white/50">If you want a full export button here, say “1”.</div>
            </>
          )}
      
/* ---------- UI bits ---------- */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-6">
      <p className="text-sm text-white/60">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  )
}

function Row({
  head,
  left,
  mid,
  right,
  dangerMid,
  dangerRight,
}: {
  head?: boolean
  left: string
  mid: string
  right: string
  dangerMid?: boolean
  dangerRight?: boolean
}) {
  return (
    <div
      className={[
        'grid grid-cols-3 px-4 py-3 border-b border-white/10',
        head ? 'text-xs text-white/60 bg-white/5' : 'text-sm',
      ].join(' ')}
    >
      <div className="truncate">{left}</div>
      <div className={['text-center truncate', dangerMid ? 'text-red-400 font-semibold' : ''].join(' ')}>{mid}</div>
      <div className={['text-right truncate', dangerRight ? 'text-red-400 font-semibold' : ''].join(' ')}>{right}</div>
    </div>
  )
}

// simple, no-deps chart (avoids Chart.js)
function MiniAreaChart({ data, max }: { data: number[]; max: number }) {
  const w = 820
  const h = 180
  const pad = 12

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const ptsArr = useMemo(() => {
    const arr = data || []
    const safeMax = Math.max(1, Number(max || 1))
    return arr.map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, arr.length - 1)
      const val = Number(v || 0)
      const y = h - pad - (Math.min(safeMax, Math.max(0, val)) * (h - pad * 2)) / safeMax
      return { x, y, v: val }
    })
  }, [data, max])

  const pts = ptsArr.length ? ptsArr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : ''

  function onMove(e: React.MouseEvent<SVGSVGElement, MouseEvent>) {
    if (!ptsArr.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * w

    let best = 0
    let bestDist = Infinity
    ptsArr.forEach((p, i) => {
      const d = Math.abs(p.x - mx)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setHoverIdx(best)
  }

  const hover = hoverIdx !== null && ptsArr[hoverIdx] ? ptsArr[hoverIdx] : null

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-[180px]"
      onMouseMove={onMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id="flowArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.02)" />
        </linearGradient>
      </defs>

      {/* grid (horizontal + vertical) */}
      {[0.2, 0.4, 0.6, 0.8].map((p) => (
        <line
          key={`h_${p}`}
          x1={pad}
          x2={w - pad}
          y1={pad + p * (h - pad * 2)}
          y2={pad + p * (h - pad * 2)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}

      {ptsArr.length > 1 &&
        [0.2, 0.4, 0.6, 0.8].map((p) => (
          <line
            key={`v_${p}`}
            y1={pad}
            y2={h - pad}
            x1={pad + p * (w - pad * 2)}
            x2={pad + p * (w - pad * 2)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}

      {ptsArr.length > 0 && (
        <>
          {/* filled area */}
          <polyline
            points={`${pts} ${w - pad},${h - pad} ${pad},${h - pad}`}
            fill="url(#flowArea)"
            stroke="none"
          />

          {/* line */}
          <polyline
            points={pts}
            fill="none"
            stroke="rgba(59,130,246,0.9)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* points */}
          {ptsArr.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? 4.2 : 2.6}
              fill={hoverIdx === i ? 'rgba(255,255,255,0.95)' : 'rgba(59,130,246,0.95)'}
              opacity={hoverIdx === null ? 0.9 : hoverIdx === i ? 1 : 0.35}
            />
          ))}
        </>
      )}

      {/* hover crosshair + tooltip */}
      {hover ? (
        <>
          <line
            x1={hover.x}
            x2={hover.x}
            y1={pad}
            y2={h - pad}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="1"
          />

          <circle cx={hover.x} cy={hover.y} r={6} fill="rgba(255,255,255,0.12)" />
          <circle cx={hover.x} cy={hover.y} r={3.2} fill="rgba(255,255,255,0.95)" />

          <g>
            {(() => {
              const bw = 132
              const bh = 44
              const x = Math.max(pad, Math.min(w - pad - bw, hover.x - bw / 2))
              const y = Math.max(pad, hover.y - 62)

              return (
                <>
                  <rect
                    x={x}
                    y={y}
                    width={bw}
                    height={bh}
                    rx={10}
                    fill="rgba(11,15,26,0.92)"
                    stroke="rgba(255,255,255,0.10)"
                  />
                  <text x={x + 12} y={y + 18} fill="rgba(255,255,255,0.75)" fontSize="11">
                    Day #{(hoverIdx ?? 0) + 1}
                  </text>
                  <text x={x + 12} y={y + 35} fill="rgba(255,255,255,0.95)" fontSize="14" fontWeight="700">
                    ${Number(hover.v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </text>
                </>
              )
            })()}
          </g>
        </>
      ) : null}
    </svg>
  )
}
/* ---------- helpers ---------- */

function displayName(p: Profile) {
  const n = `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim()
  return n || (p.email || 'Agent')
}

function formatMoney2(n: number) {
  const num = Number(n || 0)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diffDays(a: Date, b: Date) {
  const ms = b.getTime() - a.getTime()
  return Math.ceil(ms / 86400000)
}

function clampDays(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function humanGap(ms: number) {
  if (!ms || ms <= 0) return '—'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.round(hrs / 24)
  return `${days}d`
}

function buildTeamIdsFromDirectory(rootId: string, directory: any[]) {
  const children = new Map<string, string[]>()

  directory.forEach((p: any) => {
    const up = p.upline_id || null
    if (!up) return
    const upId = String(up)
    const id = String(p.id)
    if (!children.has(upId)) children.set(upId, [])
    children.get(upId)!.push(id)
  })

  const out: string[] = []
  const q: string[] = [String(rootId)]
  const seen = new Set<string>()

  while (q.length) {
    const cur = q.shift()!
    if (seen.has(cur)) continue
    seen.add(cur)
    out.push(cur)
    ;(children.get(cur) || []).forEach((k) => q.push(k))
    if (out.length > 2500) break
  }
  return out
}
const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
