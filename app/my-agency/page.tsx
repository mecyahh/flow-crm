'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import FlowRangePicker from '../components/FlowRangePicker'
import AgentLegDonut from '../components/AgentLegDonut'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_agency_owner: boolean | null
  upline_id?: string | null
  avatar_url?: string | null
}

type DealRow = {
  id: string
  user_id: string | null
  created_at: string
  premium: any
}

type AgentAgg = {
  id: string
  name: string
  email: string
  role: string
  avatar_url?: string | null
  weeklyAP: number
  monthlyAP: number
  dealsCount: number // range deals count (not shown, still useful)
  hasDownlines: boolean
}

type DownlineFilter = 'DIRECT' | 'INDIRECT' | 'ALL'

export default function MyAgencyPage() {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<Profile | null>(null)
  const [directory, setDirectory] = useState<Profile[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [toast, setToast] = useState<string | null>(null)

  // ✅ Range (same as dashboard: "YYYY-MM-DD|YYYY-MM-DD")
  const [range, setRange] = useState<string>('')

  // ✅ Downline filters
  const [downlineFilter, setDownlineFilter] = useState<DownlineFilter>('ALL')

  // ✅ used for "New Writers" (first-ever deal)
  const [priorWriters, setPriorWriters] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true

    ;(async () => {
      setLoading(true)
      setToast(null)

      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      const user = userRes.user
      if (userErr || !user) {
        window.location.href = '/login'
        return
      }

      // Load my profile
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,role,is_agency_owner,upline_id,avatar_url')
        .eq('id', user.id)
        .single()

      if (!alive) return
      if (pErr || !prof) {
        setToast('Could not load your profile (RLS?)')
        setLoading(false)
        return
      }
      setMe(prof as Profile)

      // Load directory (needed to build tree + names)
      const { data: pData, error: dirErr } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,role,is_agency_owner,upline_id,avatar_url')
        .limit(50000)

      if (!alive) return
      if (dirErr) {
        setToast('Could not load agency directory (RLS?)')
        setDirectory([])
        setDeals([])
        setLoading(false)
        return
      }

      const allProfiles = (pData || []) as Profile[]
      setDirectory(allProfiles)

      // Build my subtree ids (me + direct/indirect downlines)
      const myTreeIds = buildTreeIds(user.id, allProfiles)

      // ✅ Range start determines how far back we need to load deals
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [a] = (range || '').split('|')
      const rangeStart = a ? new Date(a + 'T00:00:00') : null

      const start = rangeStart && rangeStart < monthStart ? rangeStart : monthStart
      const startISO = start.toISOString()

      const ds = await fetchDealsForIds(myTreeIds, startISO)
      if (!alive) return
      setDeals(ds)

      // ✅ Pre-range writers (for "New Writers")
      try {
        const beforeISO = (rangeStart || startOfWeekMonday(new Date())).toISOString()
        const prev = await fetchWriterIdsBefore(myTreeIds, beforeISO)
        if (!alive) return
        setPriorWriters(prev)
      } catch {
        setPriorWriters(new Set())
      }

      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [range])

  const canSeeTree = useMemo(() => {
    // ✅ Owners + admins can view the tree under themselves ONLY
    return !!(me && (me.is_agency_owner === true || me.role === 'admin'))
  }, [me])

  const childrenMap = useMemo(() => {
    const m = new Map<string, string[]>()
    directory.forEach((p) => {
      const up = p.upline_id || null
      if (!up) return
      if (!m.has(up)) m.set(up, [])
      m.get(up)!.push(p.id)
    })
    return m
  }, [directory])

  const byId = useMemo(() => {
    const m = new Map<string, Profile>()
    directory.forEach((p) => m.set(p.id, p))
    return m
  }, [directory])

  const myTreeIds = useMemo(() => {
    if (!me) return []
    return buildTreeIds(me.id, directory)
  }, [me, directory])

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  function startOfWeekMonday(d: Date) {
    const dt = startOfDay(d)
    const day = dt.getDay()
    const diff = day === 0 ? -6 : 1 - day
    dt.setDate(dt.getDate() + diff)
    return dt
  }
  const weekStart = useMemo(() => startOfWeekMonday(new Date()), [])
  const now = useMemo(() => new Date(), [])

  const { rangeStartDt, rangeEndDt } = useMemo(() => {
    const [a, b] = (range || '').split('|')
    const start = a ? new Date(a + 'T00:00:00') : weekStart
    const end = b ? new Date(b + 'T23:59:59') : now
    return { rangeStartDt: start, rangeEndDt: end }
  }, [range, weekStart, now])

  const parsedDeals = useMemo(() => {
    return (deals || []).map((d) => {
      const dt = d.created_at ? new Date(d.created_at) : new Date()
      const prem = toPremium(d.premium)
      const ap = prem * 12
      return { ...d, dt, prem, ap }
    })
  }, [deals])

  const rangeDeals = useMemo(() => {
    return parsedDeals.filter((d) => d.dt >= rangeStartDt && d.dt <= rangeEndDt)
  }, [parsedDeals, rangeStartDt, rangeEndDt])

  const directIds = useMemo(() => {
    if (!me) return []
    return (childrenMap.get(me.id) || []).slice()
  }, [me, childrenMap])

  const indirectIds = useMemo(() => {
    if (!me) return []
    const all = new Set(myTreeIds.filter((x) => x !== me.id))
    directIds.forEach((id) => all.delete(id))
    return Array.from(all)
  }, [me, myTreeIds, directIds])

  const filteredTreeIds = useMemo(() => {
    if (!me) return []
    if (!canSeeTree) return [me.id]
    if (downlineFilter === 'DIRECT') return [me.id, ...directIds]
    if (downlineFilter === 'INDIRECT') return [me.id, ...indirectIds]
    return [me.id, ...myTreeIds.filter((x) => x !== me.id)]
  }, [me, canSeeTree, downlineFilter, directIds, indirectIds, myTreeIds])

  const agentsAgg = useMemo((): AgentAgg[] => {
    if (!me) return []

    const ids = canSeeTree ? filteredTreeIds : [me.id]

    const base = new Map<string, AgentAgg>()
    ids.forEach((id) => {
      const p = byId.get(id) || (id === me.id ? me : null)
      const name = p ? displayName(p) : 'Agent'
      base.set(id, {
        id,
        name,
        email: p?.email || '',
        role: p?.role || 'agent',
        avatar_url: p?.avatar_url || null,
        weeklyAP: 0,
        monthlyAP: 0,
        dealsCount: 0,
        hasDownlines: (childrenMap.get(id) || []).length > 0,
      })
    })

    rangeDeals.forEach((d) => {
      const uid = d.user_id
      if (!uid) return
      const row = base.get(uid)
      if (!row) return

      row.monthlyAP += d.ap
      row.dealsCount += 1
      if (d.dt >= weekStart) row.weeklyAP += d.ap
    })

    const out = Array.from(base.values())
    out.sort((a, b) => b.monthlyAP - a.monthlyAP || b.weeklyAP - a.weeklyAP)
    return out
  }, [me, canSeeTree, filteredTreeIds, byId, childrenMap, rangeDeals, weekStart])

  const top3 = useMemo(() => agentsAgg.slice(0, 3), [agentsAgg])

  const writersCount = useMemo(() => {
    const allowed = new Set(agentsAgg.map((a) => a.id))
    const uniq = new Set<string>()
    rangeDeals.forEach((d) => {
      if (!d.user_id) return
      if (!allowed.has(d.user_id)) return
      uniq.add(d.user_id)
    })
    return uniq.size
  }, [rangeDeals, agentsAgg])

  const newWritersCount = useMemo(() => {
    const allowed = new Set(agentsAgg.map((a) => a.id))
    const wroteInRange = new Set<string>()
    rangeDeals.forEach((d) => {
      if (!d.user_id) return
      if (!allowed.has(d.user_id)) return
      wroteInRange.add(d.user_id)
    })

    let count = 0
    wroteInRange.forEach((uid) => {
      if (!priorWriters.has(uid)) count += 1
    })
    return count
  }, [rangeDeals, agentsAgg, priorWriters])

  const isEmptyAgency = useMemo(() => {
    if (!me) return true
    const kids = childrenMap.get(me.id) || []
    return kids.length === 0
  }, [me, childrenMap])

  const myStats = useMemo(() => {
    if (!me) return { weeklyAP: 0, monthlyAP: 0 }
    const mine = agentsAgg.find((a) => a.id === me.id)
    return mine || { weeklyAP: 0, monthlyAP: 0 }
  }, [me, agentsAgg])

  // ✅ LEG DONUT DISTRIBUTION (Direct downlines only)
  // ✅ EXCLUDE legs unless the DIRECT downline has DOWNLINES producing in range
  const legDist = useMemo(() => {
  if (!me) return { labels: ['No Data'], values: [100] }

  const directs = (directIds || []).slice()
  if (!directs.length) return { labels: ['No Data'], values: [100] }

  // Sum AP by user in current range
  const apByUser = new Map<string, number>()
  rangeDeals.forEach((d) => {
    if (!d.user_id) return
    apByUser.set(d.user_id, (apByUser.get(d.user_id) || 0) + Number(d.ap || 0))
  })

  // ✅ Donut is ONLY for direct legs that have producing downlines
  // plus one "misc" slice for direct downlines with no producing downlines (personal only)
  const agencyLegRows: { label: string; ap: number }[] = []
  let miscNoAgencyAp = 0

  directs.forEach((root) => {
    // root + descendants
    const legIdsAll = buildTreeIds(root, directory)
    const downlineIds = legIdsAll.filter((id) => id !== root)

    const rootAp = apByUser.get(root) || 0

    let downlineAp = 0
    downlineIds.forEach((uid) => {
      downlineAp += apByUser.get(uid) || 0
    })

    // Only include "agency" legs if they have producing downlines (downlineAp > 0)
    if (downlineAp > 0) {
      const p = byId.get(root)
      const label = p ? displayName(p) : 'Agent'
      agencyLegRows.push({ label, ap: rootAp + downlineAp })
    } else {
      // No producing downlines => goes into one combined misc slice (if they personally produced)
      if (rootAp > 0) miscNoAgencyAp += rootAp
    }
  })

  // Build final donut
  const labels: string[] = []
  const values: number[] = []

  agencyLegRows.sort((a, b) => b.ap - a.ap)
  agencyLegRows.forEach((r) => {
    labels.push(r.label)
    values.push(r.ap)
  })

  if (miscNoAgencyAp > 0) {
    labels.push('No Agency Yet (Direct)')
    values.push(miscNoAgencyAp)
  }

  const total = values.reduce((s, v) => s + Number(v || 0), 0)
  if (!total) return { labels: ['No Data'], values: [100] }

  return { labels, values }
}, [me, directIds, rangeDeals, directory, byId])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3">
              <button className={btnSoft} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My Agency</h1>
            <p className="text-sm text-white/60 mt-1">{canSeeTree ? 'Detailed Agency View' : 'Your stats only.'}</p>
          </div>

          <div className="flex items-center gap-3">
            <FlowRangePicker value={range} onChange={setRange} defaultPreset="THIS_WEEK" placeholder="Select range" />
            <button
              onClick={() => window.location.reload()}
              className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* FILTER TOGGLES */}
        {canSeeTree && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDownlineFilter('DIRECT')}
              className={[
                'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                downlineFilter === 'DIRECT'
                  ? 'bg-[#FF00FF]/15 border-[#FF00FF]/30 text-[#FF77FF]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10',
              ].join(' ')}
            >
              Direct downlines
            </button>

            <button
              onClick={() => setDownlineFilter('INDIRECT')}
              className={[
                'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                downlineFilter === 'INDIRECT'
                  ? 'bg-[#F97316]/15 border-[#F97316]/30 text-[#FDBA74]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10',
              ].join(' ')}
            >
              Indirect downlines
            </button>

            <button
              onClick={() => setDownlineFilter('ALL')}
              className={[
                'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                downlineFilter === 'ALL'
                  ? 'bg-[#22c55e]/15 border-[#22c55e]/30 text-[#86EFAC]'
                  : 'bg-white/5 border-white/10 hover:bg-white/10',
              ].join(' ')}
            >
              All downlines
            </button>
          </div>
        )}

        {/* If NOT owner/admin: show own stats + message */}
        {!canSeeTree && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <MiniStat label="Weekly Production" value={loading ? '—' : `$${formatMoney2(myStats.weeklyAP)}`} />
              <MiniStat label="Monthly Production" value={loading ? '—' : `$${formatMoney2(myStats.monthlyAP)}`} />
              <MiniStat label="Writers" value={loading ? '—' : String(writersCount)} />
              <MiniStat label="New Writers" value={loading ? '—' : String(newWritersCount)} />
            </section>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="text-sm font-semibold">You have not started building an agency yet</div>
              <div className="text-xs text-white/55 mt-2">
                Once you add downlines, this page will show your tree, top producers, and persistency (coming soon).
              </div>
            </div>
          </>
        )}

        {/* Owner/admin view */}
        {canSeeTree && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <MiniStat
                label="Weekly Production (AP)"
                value={loading ? '—' : `$${formatMoney2(sum(agentsAgg, 'weeklyAP'))}`}
              />
              <MiniStat
                label="Monthly Production (AP)"
                value={loading ? '—' : `$${formatMoney2(sum(agentsAgg, 'monthlyAP'))}`}
              />
              <MiniStat label="Writers" value={loading ? '—' : String(writersCount)} />
              <MiniStat label="New Writers" value={loading ? '—' : String(newWritersCount)} />
            </section>

            {isEmptyAgency && (
              <div className="glass rounded-2xl border border-white/10 p-6 mb-6">
                <div className="text-sm font-semibold">You have not started building an agency yet</div>
                <div className="text-xs text-white/55 mt-2">
                  Add downlines under you to populate the directory and top producers.
                </div>
              </div>
            )}

            {/* Top Producers split: Left Top 3 / Right legs donut */}
            <div className="glass rounded-2xl border border-white/10 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Top Producers</div>
                  <div className="text-xs text-white/55 mt-1">Left: Top 3.</div>
                </div>
                <span className="inline-flex items-center gap-2 text-[11px] text-white/55">
                  <span className="px-2 py-1 rounded-xl border border-white/10 bg-white/5">Persistency: Coming soon</span>
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Top 3 */}
                <div className="space-y-3">
                  {(loading ? [] : top3).map((a, idx) => (
                    <TopProducerCard key={a.id} rank={idx + 1} a={a} />
                  ))}
                  {!loading && top3.length === 0 && <div className="text-sm text-white/60">No data yet.</div>}
                </div>

                {/* RIGHT: Legs donut (direct downlines only) */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold">Leg Breakdown</div>
                      <div className="text-xs text-white/55 mt-1">
                        Direct downlines only • Excludes legs with no producing downlines.
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-[11px] text-white/60">
                      Nice Work !
                    </span>
                  </div>

                  <AgentLegDonut labels={legDist.labels} values={legDist.values} glow />

                  <div className="mt-2 text-[11px] text-white/45">
                    Each slice = a direct downline’s producing downlines (only). If their downlines aren’t producing yet,
                    they won’t appear.
                  </div>
                </div>
              </div>
            </div>

            {/* Directory Table */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
                <div className="text-sm font-semibold">Agency Directory</div>
                <div className="text-xs text-white/60">
                  {loading ? 'Loading…' : `${agentsAgg.length} agent${agentsAgg.length === 1 ? '' : 's'} in view`}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-white/55">
                    <tr className="border-b border-white/10">
                      <th className="text-left px-6 py-3 whitespace-nowrap">Agent</th>
                      <th className="text-left px-6 py-3 whitespace-nowrap">Role</th>
                      <th className="text-right px-6 py-3 whitespace-nowrap">Weekly AP</th>
                      <th className="text-right px-6 py-3 whitespace-nowrap">Monthly AP</th>
                      <th className="text-right px-6 py-3 whitespace-nowrap">Deals</th>
                      <th className="text-right px-6 py-3 whitespace-nowrap">Persistency</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading && (
                      <tr>
                        <td className="px-6 py-6 text-white/60" colSpan={6}>
                          Loading…
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      agentsAgg.map((a) => (
                        <tr key={a.id} className="border-b border-white/10 hover:bg-white/5 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                {a.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs text-white/60">{(a.name || 'A').slice(0, 1).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{a.name}</div>
                                <div className="text-[11px] text-white/50 truncate">
                                  {a.email || '—'} {a.hasDownlines ? '• has downlines' : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-[11px] text-white/70">
                              {a.role || 'agent'}
                            </span>
                          </td>

                          <td
                            className={[
                              'px-6 py-4 text-right font-semibold whitespace-nowrap',
                              a.weeklyAP <= 0 ? 'text-red-400' : 'text-green-300',
                            ].join(' ')}
                          >
                            ${formatMoney2(a.weeklyAP)}
                          </td>

                          <td
                            className={[
                              'px-6 py-4 text-right font-semibold whitespace-nowrap',
                              a.monthlyAP <= 0 ? 'text-red-400' : 'text-green-300',
                            ].join(' ')}
                          >
                            ${formatMoney2(a.monthlyAP)}
                          </td>

                          <td className="px-6 py-4 text-right font-semibold whitespace-nowrap">{a.dealsCount}</td>

                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-[11px] text-white/60">
                              Coming soon
                            </span>
                          </td>
                        </tr>
                      ))}

                    {!loading && agentsAgg.length === 0 && (
                      <tr>
                        <td className="px-6 py-6 text-white/60" colSpan={6}>
                          No agents found in this view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- helpers (isolated) ---------------- */

function buildTreeIds(rootId: string, profiles: Profile[]) {
  const children = new Map<string, string[]>()
  profiles.forEach((p) => {
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

async function fetchDealsForIds(ids: string[], startISO: string): Promise<DealRow[]> {
  if (!ids.length) return []
  const chunks = chunk(ids, 500)
  const out: DealRow[] = []

  for (const c of chunks) {
    const { data, error } = await supabase
      .from('deals')
      .select('id,user_id,created_at,premium')
      .in('user_id', c)
      .gte('created_at', startISO)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) continue
    out.push(...(((data || []) as DealRow[]) || []))
  }

  return out
}

async function fetchWriterIdsBefore(ids: string[], beforeISO: string): Promise<Set<string>> {
  const out = new Set<string>()
  if (!ids.length) return out
  const chunks = chunk(ids, 500)

  for (const c of chunks) {
    const { data, error } = await supabase
      .from('deals')
      .select('user_id')
      .in('user_id', c)
      .lt('created_at', beforeISO)
      .limit(100000)

    if (error) continue
    ;(data || []).forEach((r: any) => {
      if (r?.user_id) out.add(String(r.user_id))
    })
  }

  return out
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
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

function displayName(p: Profile) {
  const n = `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim()
  return n || (p.email || 'Agent')
}

function formatMoney2(n: number) {
  const num = Number(n || 0)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function sum(rows: any[], key: string) {
  return rows.reduce((s, r) => s + Number(r?.[key] || 0), 0)
}

/* ---------------- UI ---------------- */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-6">
      <p className="text-sm text-white/60">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  )
}

function TopProducerCard({ rank, a }: { rank: number; a: AgentAgg }) {
  const badge =
    rank === 1
      ? 'bg-yellow-400/15 text-yellow-200 border-yellow-300/25'
      : rank === 2
      ? 'bg-white/10 text-white/85 border-white/20'
      : 'bg-orange-500/10 text-orange-200 border-orange-400/25'

  const moneyCls = a.monthlyAP <= 0 ? 'text-red-400' : 'text-green-300'
  const weeklyCls = a.weeklyAP <= 0 ? 'text-red-400' : 'text-white/85'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
          {a.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-white/60">{(a.name || 'A').slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="min-w-0">
          <div className="font-semibold truncate">{a.name}</div>
          <div className="text-[11px] text-white/50 truncate">
            Weekly <span className={weeklyCls}>${formatMoney2(a.weeklyAP)}</span> • Deals {a.dealsCount}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className={['inline-flex items-center px-2 py-1 rounded-xl border text-[11px] font-bold', badge].join(' ')}>
          #{rank}
        </div>
        <div className={['mt-2 font-semibold', moneyCls].join(' ')}>${formatMoney2(a.monthlyAP)}</div>
        <div className="text-[11px] text-white/50">Monthly AP</div>
      </div>
    </div>
  )
}

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
