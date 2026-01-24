// ✅ CREATE NEW FILE: /app/my-agency/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
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
  dealsCount: number // month-to-date deals
  hasDownlines: boolean
}

export default function MyAgencyPage() {
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<Profile | null>(null)
  const [directory, setDirectory] = useState<Profile[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [toast, setToast] = useState<string | null>(null)

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

      // Load directory (needed to build tree + render names)
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

      // Deals: only pull what we need (month-to-date), scoped to my tree
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthStartISO = monthStart.toISOString()

      const ds = await fetchDealsForIds(myTreeIds, monthStartISO)
      if (!alive) return

      setDeals(ds)
      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [])

  const canSeeTree = useMemo(() => {
    // ✅ Owners + admins can view the tree under themselves ONLY
    return !!(me && (me.is_agency_owner === true || me.role === 'admin'))
  }, [me])

  const myTreeIds = useMemo(() => {
    if (!me) return [me?.id].filter(Boolean) as string[]
    return buildTreeIds(me.id, directory)
  }, [me, directory])

  const now = useMemo(() => new Date(), [])
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const startOfWeekMonday = (d: Date) => {
    const dt = startOfDay(d)
    const day = dt.getDay()
    const diff = day === 0 ? -6 : 1 - day
    dt.setDate(dt.getDate() + diff)
    return dt
  }
  const weekStart = useMemo(() => startOfWeekMonday(new Date()), [])
  const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), [])

  const parsedDeals = useMemo(() => {
    return (deals || []).map((d) => {
      const dt = d.created_at ? new Date(d.created_at) : new Date()
      const prem = toPremium(d.premium)
      const ap = prem * 12
      return { ...d, dt, prem, ap }
    })
  }, [deals])

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

  const agentsAgg = useMemo((): AgentAgg[] => {
    if (!me) return []

    // If they can’t see tree, only show themselves (and message)
    const ids = canSeeTree ? myTreeIds : [me.id]

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

    parsedDeals.forEach((d) => {
      const uid = d.user_id
      if (!uid) return
      const row = base.get(uid)
      if (!row) return

      // month-to-date deals (we only fetched from monthStart forward)
      row.monthlyAP += d.ap
      row.dealsCount += 1

      // week-to-date
      if (d.dt >= weekStart) row.weeklyAP += d.ap
    })

    const out = Array.from(base.values())

    // sort: monthly AP desc, then weekly AP desc
    out.sort((a, b) => b.monthlyAP - a.monthlyAP || b.weeklyAP - a.weeklyAP)
    return out
  }, [me, canSeeTree, myTreeIds, byId, childrenMap, parsedDeals, weekStart])

  const topProducers = useMemo(() => agentsAgg.slice(0, 5), [agentsAgg])

  const isEmptyAgency = useMemo(() => {
    // “building an agency” means at least 1 downline under you
    if (!me) return true
    const kids = childrenMap.get(me.id) || []
    return kids.length === 0
  }, [me, childrenMap])

  const myStats = useMemo(() => {
    if (!me) return { weeklyAP: 0, monthlyAP: 0, dealsCount: 0 }
    const mine = agentsAgg.find((a) => a.id === me.id)
    return mine || { weeklyAP: 0, monthlyAP: 0, dealsCount: 0 }
  }, [me, agentsAgg])

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
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My Agency</h1>
            <p className="text-sm text-white/60 mt-1">
              {canSeeTree ? 'Your tree only • direct + indirect downlines.' : 'Your stats only.'}
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>

        {/* If NOT owner/admin: show own stats + message */}
        {!canSeeTree && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <MiniStat label="Weekly Production (AP)" value={loading ? '—' : `$${formatMoney2(myStats.weeklyAP)}`} />
              <MiniStat label="Monthly Production (AP)" value={loading ? '—' : `$${formatMoney2(myStats.monthlyAP)}`} />
              <MiniStat label="Deals (MTD)" value={loading ? '—' : String(myStats.dealsCount)} />
            </section>

            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="text-sm font-semibold">You have not started building an agency yet</div>
              <div className="text-xs text-white/55 mt-2">
                Once you add downlines, this page will show your tree, top producers, and persistency (coming soon).
              </div>
            </div>
          </>
        )}

        {/* Owner/admin view (tree only) */}
        {canSeeTree && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <MiniStat label="Weekly Production (AP)" value={loading ? '—' : `$${formatMoney2(sum(agentsAgg, 'weeklyAP'))}`} />
              <MiniStat label="Monthly Production (AP)" value={loading ? '—' : `$${formatMoney2(sum(agentsAgg, 'monthlyAP'))}`} />
              <MiniStat label="Deals (MTD)" value={loading ? '—' : String(sum(agentsAgg, 'dealsCount'))} />
            </section>

            {isEmptyAgency && (
              <div className="glass rounded-2xl border border-white/10 p-6 mb-6">
                <div className="text-sm font-semibold">You have not started building an agency yet</div>
                <div className="text-xs text-white/55 mt-2">
                  Add downlines under you to populate the directory and top producers.
                </div>
              </div>
            )}

            {/* Top Producers */}
            <div className="glass rounded-2xl border border-white/10 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Top Producers</div>
                  <div className="text-xs text-white/55 mt-1">Ranked by monthly production (AP).</div>
                </div>
                <span className="inline-flex items-center gap-2 text-[11px] text-white/55">
                  <span className="px-2 py-1 rounded-xl border border-white/10 bg-white/5">Persistency: Coming soon</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(loading ? [] : topProducers).map((a, idx) => (
                  <TopProducerCard key={a.id} rank={idx + 1} a={a} />
                ))}
                {!loading && topProducers.length === 0 && (
                  <div className="text-sm text-white/60">No data yet.</div>
                )}
              </div>
            </div>

            {/* Directory Table */}
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
                <div className="text-sm font-semibold">Agency Directory</div>
                <div className="text-xs text-white/60">
                  {loading ? 'Loading…' : `${agentsAgg.length} agent${agentsAgg.length === 1 ? '' : 's'} in your tree`}
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
                      <th className="text-right px-6 py-3 whitespace-nowrap">Deals (MTD)</th>
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

                          <td className="px-6 py-4 text-right font-semibold text-green-300 whitespace-nowrap">
                            ${formatMoney2(a.weeklyAP)}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-green-300 whitespace-nowrap">
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
                          No agents found in your tree.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              Tree scope is strict: only you + your direct/indirect downlines. No other agency’s people are included.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- helpers (isolated) ---------------- */

function buildTreeIds(rootId: string, profiles: Profile[]) {
  // BFS: root + all descendants via upline_id
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
    if (out.length > 2500) break // safety cap
  }
  return out
}

async function fetchDealsForIds(ids: string[], startISO: string): Promise<DealRow[]> {
  if (!ids.length) return []
  const chunks = chunk(ids, 500) // safe for .in() limits
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
            Weekly ${formatMoney2(a.weeklyAP)} • Deals {a.dealsCount}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className={['inline-flex items-center px-2 py-1 rounded-xl border text-[11px] font-bold', badge].join(' ')}>
          #{rank}
        </div>
        <div className="mt-2 font-semibold text-green-300">${formatMoney2(a.monthlyAP)}</div>
        <div className="text-[11px] text-white/50">Monthly AP</div>
      </div>
    </div>
  )
}

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
