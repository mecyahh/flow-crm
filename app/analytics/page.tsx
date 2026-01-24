// ✅ FULL REPLACEMENT FILE: /app/analytics/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import FlowRangePicker from '@/app/components/FlowRangePicker'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_agency_owner: boolean | null
  upline_id?: string | null
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
  annualNum: number
  companySafe: string
  agentSafe: string
}

const UNDER_5K_ANNUAL = 5000

type Mode = 'personal' | 'team'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [me, setMe] = useState<Profile | null>(null)
  const [agents, setAgents] = useState<Profile[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])

  // ✅ Range string: "YYYY-MM-DD|YYYY-MM-DD" (inclusive end)
  const [rangeValue, setRangeValue] = useState<string>('')

  // ✅ collapsibles
  const [underOpen, setUnderOpen] = useState(false)
  const [nonWriterOpen, setNonWriterOpen] = useState(false)

  // ✅ team scope for owners (self + downlines)
  const [teamIds, setTeamIds] = useState<string[] | null>(null)

  // ✅ Personal vs Team toggle (Personal default)
  const [mode, setMode] = useState<Mode>('personal')

  const isAdmin = me?.role === 'admin'
  const isOwner = !!me?.is_agency_owner
  const canTeamView = isOwner || isAdmin

  // IMPORTANT: you asked "ONLY show data for signed-in agent, not company analytics"
  // So: Admin is treated like a normal user (personal default). Team mode is only meaningful for owners.
  const teamModeAllowed = isOwner && mode === 'team'

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!me?.id) return
    ;(async () => {
      if (!isOwner) {
        setTeamIds([me.id])
        return
      }
      try {
        const ids = await buildTeamIds(me.id)
        setTeamIds(ids.length ? ids : [me.id])
      } catch {
        setTeamIds([me.id])
      }
    })()
  }, [me?.id, isOwner])

  useEffect(() => {
    if (!me?.id) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, rangeValue, mode, teamIds])

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
      .select('id,email,first_name,last_name,role,is_agency_owner,upline_id')
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

  async function buildTeamIds(rootId: string) {
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
    while (q.length) {
      const cur = q.shift()!
      if (seen.has(cur)) continue
      seen.add(cur)
      out.push(cur)
      const kids = children.get(cur) || []
      kids.forEach((k) => q.push(k))
      if (out.length > 2500) break
    }
    return out
  }

  function parseRange(value: string) {
    if (!value) return { start: '', end: '' }
    const [a, b] = value.split('|')
    if (!a) return { start: '', end: '' }
    return { start: a, end: b || a }
  }

  const parsedRange = useMemo(() => parseRange(rangeValue), [rangeValue])

  // ✅ query boundaries:
  // - start inclusive at 00:00
  // - end EXCLUSIVE = (endInclusive + 1 day) at 00:00
  const queryStartISO = useMemo(() => {
    if (!parsedRange.start) return '1900-01-01T00:00:00.000Z'
    return new Date(parsedRange.start + 'T00:00:00').toISOString()
  }, [parsedRange.start])

  const queryEndISO = useMemo(() => {
    if (!parsedRange.end) return '2999-12-31T00:00:00.000Z'
    const d = new Date(parsedRange.end + 'T00:00:00')
    d.setDate(d.getDate() + 1) // exclusive boundary
    return d.toISOString()
  }, [parsedRange.end])

  async function loadData() {
    if (!me) return
    setLoading(true)
    setToast(null)

    // ✅ scope ids for this view
    const idsForView =
      teamModeAllowed && teamIds && teamIds.length > 0
        ? teamIds
        : // personal: always only me
          [me.id]

    // ✅ agents directory (only what we need for names + non-writers)
    try {
      const base = supabase
        .from('profiles')
        .select('id,email,first_name,last_name,role,is_agency_owner,upline_id')
        .order('created_at', { ascending: false })
        .limit(5000)

      const { data: aData } = await base.in('id', idsForView)
      setAgents((aData || []) as Profile[])
    } catch {
      setAgents([])
    }

    // ✅ Deals query: prefer secure RPC if present, fallback to direct query.
    // RPC name assumed: analytics_deals(start, end, mode)
    // NOTE: your SQL should return premium as numeric/text (NOT jsonb).
    try {
      const rpcMode: Mode = teamModeAllowed ? 'team' : 'personal'

      const { data: rpcData, error: rpcErr } = await supabase.rpc('analytics_deals', {
        p_start: queryStartISO,
        p_end: queryEndISO,
        p_mode: rpcMode,
      })

      if (!rpcErr && rpcData) {
        setDeals((rpcData || []) as DealRow[])
        setLoading(false)
        return
      }
      // if rpc fails, fall through to direct query
    } catch {
      // fall through
    }

    // Fallback (requires RLS policy on deals)
    const q = supabase
      .from('deals')
      .select('id,created_at,agent_id,premium,company')
      .gte('created_at', queryStartISO)
      .lt('created_at', queryEndISO)
      .order('created_at', { ascending: true })
      .limit(20000)

    const scoped =
      teamModeAllowed && teamIds && teamIds.length > 0 ? q.in('agent_id', teamIds) : q.eq('agent_id', me.id)

    const { data: dData, error: dErr } = await scoped

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
      const annual = p * 12

      const companySafe = (d.company || 'Other').trim() || 'Other'

      const prof = d.agent_id ? agentsById.get(d.agent_id) : null
      const agentSafe = prof ? displayName(prof) : d.agent_id ? 'Agent' : '—'

      return {
        ...d,
        dt,
        premiumNum: p,
        annualNum: annual,
        companySafe,
        agentSafe,
      }
    })
  }, [deals, agentsById])

  /* ---------------- KPIs ---------------- */

  const totalAnnual = useMemo(() => parsed.reduce((s, d) => s + d.annualNum, 0), [parsed])
  const dealsCount = parsed.length
  const avgPremiumPerDeal = dealsCount ? parsed.reduce((s, d) => s + d.premiumNum, 0) / dealsCount : 0

  const perAgent = useMemo(() => {
    const map = new Map<
      string,
      { agent_id: string; name: string; annual: number; premium: number; deals: number; dts: number[] }
    >()

    parsed.forEach((d) => {
      const aid = d.agent_id || 'unknown'
      const name = d.agent_id
        ? agentsById.get(d.agent_id)
          ? displayName(agentsById.get(d.agent_id)!)
          : d.agentSafe
        : '—'

      if (!map.has(aid)) map.set(aid, { agent_id: aid, name, annual: 0, premium: 0, deals: 0, dts: [] })
      const row = map.get(aid)!
      row.premium += d.premiumNum
      row.annual += d.annualNum
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
        avgAnnualPerDeal: r.deals ? r.annual / r.deals : 0,
      }
    })

    rows.sort((a, b) => b.annual - a.annual)
    return rows
  }, [parsed, agentsById])

  const avgAnnualPerAgent = useMemo(() => {
    const active = perAgent.filter((a) => a.deals > 0 && a.agent_id !== 'unknown')
    if (!active.length) return 0
    return active.reduce((s, a) => s + (a.annual || 0), 0) / active.length
  }, [perAgent])

  const avgTimeBetweenDeals = useMemo(() => {
    const with2 = perAgent.filter((a) => a.deals >= 2 && a.avgGapMs > 0)
    if (!with2.length) return 0
    return with2.reduce((s, a) => s + a.avgGapMs, 0) / with2.length
  }, [perAgent])

  const under5kAgents = useMemo(() => {
    return perAgent
      .filter((a) => a.agent_id !== 'unknown' && a.annual < UNDER_5K_ANNUAL)
      .slice()
      .sort((a, b) => a.annual - b.annual)
  }, [perAgent])

  const nonWriters = useMemo(() => {
    const activeIds = new Set(perAgent.filter((a) => a.deals > 0).map((a) => a.agent_id))
    const list = agents
      .filter((a) => !activeIds.has(a.id))
      .map((a) => ({ id: a.id, name: displayName(a), email: a.email || '' }))
      .sort((x, y) => x.name.localeCompare(y.name))
    return list
  }, [agents, perAgent])

  const topCarrier = useMemo(() => {
    const m = new Map<string, number>()
    parsed.forEach((d) => m.set(d.companySafe, (m.get(d.companySafe) || 0) + d.annualNum))
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

  const dailyAnnual = useMemo(() => {
    const s = parsedRange.start ? new Date(parsedRange.start + 'T00:00:00') : new Date()
    const e = parsedRange.end ? new Date(parsedRange.end + 'T00:00:00') : new Date()
    const days = clampDays(diffDays(s, e) + 1, 1, 62)

    const out: { label: string; v: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(s)
      d.setDate(d.getDate() + i)
      const key = toISODateLocal(d)
      out.push({ label: key, v: 0 })
    }

    const idx = new Map<string, number>()
    out.forEach((x, i) => idx.set(x.label, i))

    parsed.forEach((d) => {
      const k = toISODateLocal(d.dt)
      const i = idx.get(k)
      if (i !== undefined) out[i].v += d.annualNum
    })

    return out
  }, [parsed, parsedRange.start, parsedRange.end])

  const trendMax = useMemo(() => Math.max(1, ...dailyAnnual.map((x) => x.v)), [dailyAnnual])

  // For owners only, we show by-carrier in TEAM mode.
  const byCarrier = useMemo(() => {
    const m = new Map<string, { carrier: string; annual: number; deals: number }>()
    parsed.forEach((d) => {
      const k = d.companySafe
      if (!m.has(k)) m.set(k, { carrier: k, annual: 0, deals: 0 })
      const r = m.get(k)!
      r.annual += d.annualNum
      r.deals += 1
    })
    return Array.from(m.values()).sort((a, b) => b.annual - a.annual)
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
            <p className="text-sm text-white/60 mt-1">Range applies to everything • Annual premium shown (premium × 12).</p>
          </div>

          <div className="flex items-center gap-3">
            {/* ✅ Toggle (Personal orange default, Team fuchsia) */}
            <ModeToggle
              canTeam={canTeamView}
              isOwner={isOwner}
              mode={mode}
              onChange={(m) => setMode(m)}
            />

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
              <div className="text-xs text-white/55 mt-1">Default: Current week (Mon → Sun).</div>
            </div>

            <FlowRangePicker value={rangeValue} onChange={setRangeValue} defaultPreset="THIS_WEEK" />
          </div>

          <div className="mt-3 text-[11px] text-white/45">
            Query uses end <span className="text-white/60">(exclusive)</span> under the hood to include the full last day.
          </div>
        </div>

        {/* TOP KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <MiniStat label="Total Annual Premium" value={loading ? '—' : `$${formatMoney2(totalAnnual)}`} />
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
            <div className="text-sm font-semibold">Average annual premium per agent</div>
            <div className="text-xs text-white/55 mt-1">Average annual total per active agent in range.</div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Avg</div>
              <div className="mt-1 text-3xl font-semibold">{loading ? '—' : `$${formatMoney2(avgAnnualPerAgent)}`}</div>
            </div>
          </div>

          {/* Collapsible under 5k */}
          <div className="glass rounded-2xl border border-white/10 p-6">
            <button type="button" onClick={() => setUnderOpen((s) => !s)} className="w-full flex items-center justify-between">
              <div className="text-left">
                <div className="text-sm font-semibold">Agents under ${formatMoney2(UNDER_5K_ANNUAL)} (Annual)</div>
                <div className="text-xs text-white/55 mt-1">Collapsible for a cleaner look.</div>
              </div>
              <span className="text-white/60 text-sm">{underOpen ? '▴' : '▾'}</span>
            </button>

            {underOpen && (
              <>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <Row head left="Agent" mid="Annual" right="Deals" />
                  {(loading ? [] : under5kAgents.slice(0, 12)).map((a) => (
                    <Row
                      key={a.agent_id}
                      left={a.name}
                      mid={`$${formatMoney2(a.annual)}`}
                      right={String(a.deals)}
                      dangerMid
                    />
                  ))}
                  {!loading && under5kAgents.length === 0 && <Row left="—" mid="None ✅" right="—" />}
                </div>

                <div className="mt-3 text-[11px] text-white/50">Bottom performers first.</div>
              </>
            )}
          </div>
        </section>

        {/* TREND + BREAKDOWNS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Daily Annual Trend</h2>
              <span className="text-xs text-white/60">
                {parsedRange.start || '—'} → {parsedRange.end || '—'}
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
              <MiniAreaChart data={dailyAnnual.map((x) => x.v)} max={trendMax} labels={dailyAnnual.map((x) => x.label)} />

              <div className="mt-3 grid grid-cols-4 md:grid-cols-8 gap-2 text-[11px] text-white/45">
                {dailyAnnual.slice(Math.max(0, dailyAnnual.length - 8)).map((x) => (
                  <div key={x.label} className="truncate">
                    {x.label.slice(5)}: <span className="text-white/70">${formatMoney2(x.v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ✅ By Carrier ONLY when Owner + Team mode */}
          {teamModeAllowed ? (
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="text-base font-semibold mb-4">Team By Carrier (Annual)</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <Row head left="Carrier" mid="Annual" right="Deals" />
                {(loading ? [] : byCarrier.slice(0, 10)).map((c) => (
                  <Row key={c.carrier} left={c.carrier} mid={`$${formatMoney2(c.annual)}`} right={String(c.deals)} />
                ))}
                {!loading && byCarrier.length === 0 && <Row left="—" mid="No data" right="—" />}
              </div>
              <div className="mt-3 text-[11px] text-white/50">Visible in Team mode for agency owners.</div>
            </div>
          ) : (
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="text-base font-semibold mb-2">By Carrier</div>
              <div className="text-sm text-white/60">
                {isOwner ? 'Switch to Team to see downline carrier breakdown.' : 'Personal analytics only.'}
              </div>
            </div>
          )}
        </section>

        {/* NON WRITERS (collapsible) */}
        <section className="mt-6 glass rounded-2xl border border-white/10 p-6">
          <button type="button" onClick={() => setNonWriterOpen((s) => !s)} className="w-full flex items-center justify-between mb-2">
            <div className="text-left">
              <h2 className="text-base font-semibold">Non Writers</h2>
              <div className="text-xs text-white/55 mt-1">Agents with 0 deals in the selected range.</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-white/60">
                Total: <span className="text-white font-semibold">{loading ? '—' : nonWriters.length}</span>
              </div>
              <span className="text-white/60 text-sm">{nonWriterOpen ? '▴' : '▾'}</span>
            </div>
          </button>

          {nonWriterOpen && (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden mt-4">
                <Row head left="Agent" mid="Email" right="Status" />
                {(loading ? [] : nonWriters.slice(0, 40)).map((n) => (
                  <Row key={n.id} left={n.name} mid={n.email || '—'} right="0 deals" dangerRight />
                ))}
                {!loading && nonWriters.length === 0 && <Row left="—" mid="Everyone wrote ✅" right="—" />}
              </div>

              <div className="mt-3 text-[11px] text-white/50">Collapsed by default for a cleaner look.</div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

/* ---------- UI bits ---------- */

function ModeToggle({
  canTeam,
  isOwner,
  mode,
  onChange,
}: {
  canTeam: boolean
  isOwner: boolean
  mode: 'personal' | 'team'
  onChange: (m: 'personal' | 'team') => void
}) {
  // team is only meaningful for owners. If admin, we still hide team to avoid “company analytics”.
  if (!canTeam || !isOwner) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
        Personal
      </div>
    )
  }

  const isTeam = mode === 'team'

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-white/60 mr-1">View</div>

      <button
        type="button"
        onClick={() => onChange('personal')}
        className={[
          'rounded-2xl border px-3 py-2 text-xs font-semibold transition',
          !isTeam
            ? 'border-orange-400/40 bg-orange-500/15 text-orange-200'
            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
        ].join(' ')}
      >
        Personal
      </button>

      <button
        type="button"
        onClick={() => onChange('team')}
        className={[
          'rounded-2xl border px-3 py-2 text-xs font-semibold transition',
          isTeam
            ? 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200'
            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10',
        ].join(' ')}
      >
        Team
      </button>
    </div>
  )
}

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
    <div className={['grid grid-cols-3 px-4 py-3 border-b border-white/10', head ? 'text-xs text-white/60 bg-white/5' : 'text-sm'].join(' ')}>
      <div className="truncate">{left}</div>
      <div className={['text-center truncate', dangerMid ? 'text-red-400 font-semibold' : ''].join(' ')}>{mid}</div>
      <div className={['text-right truncate', dangerRight ? 'text-red-400 font-semibold' : ''].join(' ')}>{right}</div>
    </div>
  )
}

/**
 * Mini chart with:
 * - horizontal + vertical grid
 * - points
 * - hover tracking + tooltip
 */
function MiniAreaChart({ data, max, labels }: { data: number[]; max: number; labels: string[] }) {
  const w = 820
  const h = 180
  const pad = 12

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const ptsArr = useMemo(() => {
    return (data || []).map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1)
      const y = h - pad - (Math.min(max, Math.max(0, v)) * (h - pad * 2)) / max
      return { x, y, v: Number(v || 0) }
    })
  }, [data, max])

  const pts = ptsArr.length ? ptsArr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : ''

  function onMove(e: React.MouseEvent<SVGSVGElement, MouseEvent>) {
    if (!ptsArr.length) return
    const rect = (e.currentTarget as any).getBoundingClientRect()
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[180px]" onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
      <defs>
        <linearGradient id="flowArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0.02)" />
        </linearGradient>
      </defs>

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

      {data.length > 1 &&
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
          <polyline points={`${pts} ${w - pad},${h - pad} ${pad},${h - pad}`} fill="url(#flowArea)" stroke="none" />
          <polyline points={pts} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
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

      {hover ? (
        <>
          <line x1={hover.x} x2={hover.x} y1={pad} y2={h - pad} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <circle cx={hover.x} cy={hover.y} r={6} fill="rgba(255,255,255,0.12)" />
          <circle cx={hover.x} cy={hover.y} r={3.2} fill="rgba(255,255,255,0.95)" />

          <g>
            {(() => {
              const bw = 172
              const bh = 52
              const x = Math.max(pad, Math.min(w - pad - bw, hover.x - bw / 2))
              const y = Math.max(pad, hover.y - 70)
              const dayLabel = labels?.[hoverIdx!] ? labels[hoverIdx!].slice(5) : `Day #${hoverIdx! + 1}`

              return (
                <>
                  <rect x={x} y={y} width={bw} height={bh} rx={10} fill="rgba(11,15,26,0.92)" stroke="rgba(255,255,255,0.10)" />
                  <text x={x + 12} y={y + 20} fill="rgba(255,255,255,0.75)" fontSize="11">
                    {dayLabel}
                  </text>
                  <text x={x + 12} y={y + 40} fill="rgba(255,255,255,0.95)" fontSize="14" fontWeight="700">
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

function toISODateLocal(d: Date) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diffDays(a: Date, b: Date) {
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((b0 - a0) / 86400000)
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

const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
