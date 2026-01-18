// /app/dashboard/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type DealRow = {
  id: string
  created_at: string
  agent_id: string | null
  full_name: string | null
  company: string | null
  premium: number | null
  coverage: number | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type LeaderRow = {
  id: string
  name: string
  premium: number
}

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function isoToPretty(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

function isoDateOnly(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfDayISO(dateISO: string) {
  const [y, m, d] = dateISO.split('-').map((x) => Number(x))
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
  return dt.toISOString()
}

function endOfDayISO(dateISO: string) {
  const [y, m, d] = dateISO.split('-').map((x) => Number(x))
  const dt = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999)
  return dt.toISOString()
}

function startOfWeekISO(now: Date) {
  const d = new Date(now)
  const day = (d.getDay() + 6) % 7 // Mon=0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfMonthISO(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return d.toISOString()
}

function hourLabel(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function TopCarrierDonut({
  label,
  value,
}: {
  label: string
  value: number // 0..1
}) {
  const pct = Math.max(0, Math.min(1, value))
  const deg = Math.round(pct * 360)
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-16 w-16 rounded-full border border-white/10"
        style={{
          background: `conic-gradient(rgba(59,130,246,0.9) ${deg}deg, rgba(255,255,255,0.10) 0deg)`,
        }}
      />
      <div>
        <div className="text-xs text-white/60">Deals Submitted</div>
        <div className="text-lg font-semibold">{label}</div>
        <div className="text-xs text-white/55 mt-1">{Math.round(pct * 100)}%</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [meName, setMeName] = useState<string>('')

  // date picker for the 3 top cards (production)
  const [dayPick, setDayPick] = useState<string>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  // metrics
  const [todayProd, setTodayProd] = useState(0)
  const [weekProd, setWeekProd] = useState(0)
  const [monthProd, setMonthProd] = useState(0)

  const [writingAgents, setWritingAgents] = useState(0)

  // right side leaderboard (top 5)
  const [leaders, setLeaders] = useState<LeaderRow[]>([])

  // right side donut: top company by deals count
  const [topCompany, setTopCompany] = useState<{ name: string; share: number } | null>(null)

  // recent activity
  const [recent, setRecent] = useState<
    { id: string; agent: string; premium: number; time: string }[]
  >([])

  useEffect(() => {
    let alive = true
    async function boot() {
      try {
        setLoading(true)

        // auth
        const { data: userRes, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw new Error(`auth.getUser: ${userErr.message}`)
        const uid = userRes.user?.id
        if (!uid) throw new Error('Not logged in. Go to /login first.')

        // profile for welcome back + name
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('id', uid)
          .single()

        const name =
          `${(prof?.first_name || '').trim()} ${(prof?.last_name || '').trim()}`.trim() ||
          (prof?.email || '').trim() ||
          'Agent'

        if (!alive) return
        setMeName(name)

        // build time windows
        const now = new Date()
        const dayStart = startOfDayISO(dayPick)
        const dayEnd = endOfDayISO(dayPick)
        const weekStart = startOfWeekISO(now)
        const monthStart = startOfMonthISO(now)

        // 1) Production totals (today/week/month)
        // Today = filtered by selected dayPick
        const [{ data: dayDeals, error: dayErr }, { data: weekDeals, error: weekErr }, { data: monthDeals, error: monthErr }] =
          await Promise.all([
            supabase
              .from('deals')
              .select('premium, agent_id')
              .gte('created_at', dayStart)
              .lte('created_at', dayEnd),
            supabase.from('deals').select('premium, agent_id').gte('created_at', weekStart),
            supabase.from('deals').select('premium, agent_id').gte('created_at', monthStart),
          ])

        if (dayErr) throw new Error(dayErr.message)
        if (weekErr) throw new Error(weekErr.message)
        if (monthErr) throw new Error(monthErr.message)

        const sumPremium = (rows: any[] | null | undefined) =>
          (rows || []).reduce((acc, r) => acc + (Number(r.premium) || 0), 0)

        const distinctAgents = (rows: any[] | null | undefined) => {
          const s = new Set<string>()
          ;(rows || []).forEach((r) => {
            if (r.agent_id) s.add(String(r.agent_id))
          })
          return s.size
        }

        const daySum = sumPremium(dayDeals as any[])
        const weekSum = sumPremium(weekDeals as any[])
        const monthSum = sumPremium(monthDeals as any[])

        const wa = distinctAgents(dayDeals as any[]) // writing agents = agents who wrote on selected day

        if (!alive) return
        setTodayProd(daySum)
        setWeekProd(weekSum)
        setMonthProd(monthSum)
        setWritingAgents(wa)

        // 2) Top company by deal count (this month)
        const { data: monthForCompany, error: compErr } = await supabase
          .from('deals')
          .select('company')
          .gte('created_at', monthStart)
          .limit(5000)

        if (compErr) throw new Error(compErr.message)

        const companyCounts = new Map<string, number>()
        ;(monthForCompany as DealRow[] | null | undefined)?.forEach((r: any) => {
          const c = (r.company || 'Unknown').toString().trim() || 'Unknown'
          companyCounts.set(c, (companyCounts.get(c) || 0) + 1)
        })

        let topName = 'No Data'
        let topCount = 0
        let totalCount = 0
        for (const [, v] of companyCounts) totalCount += v
        for (const [k, v] of companyCounts) {
          if (v > topCount) {
            topCount = v
            topName = k
          }
        }

        if (!alive) return
        setTopCompany(
          totalCount > 0 ? { name: topName, share: topCount / totalCount } : { name: 'No Data', share: 0 }
        )

        // 3) Leaderboard (top 5 by premium, this month)
        const { data: monthDealsForLeaders, error: ldErr } = await supabase
          .from('deals')
          .select('agent_id, premium')
          .gte('created_at', monthStart)
          .limit(5000)

        if (ldErr) throw new Error(ldErr.message)

        const totals = new Map<string, number>()
        const agentIds = new Set<string>()
        ;(monthDealsForLeaders as any[]).forEach((r) => {
          const aid = r.agent_id ? String(r.agent_id) : ''
          if (!aid) return
          agentIds.add(aid)
          totals.set(aid, (totals.get(aid) || 0) + (Number(r.premium) || 0))
        })

        let profiles: ProfileRow[] = []
        if (agentIds.size > 0) {
          const { data: profs, error: pErr } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', Array.from(agentIds))
          if (pErr) throw new Error(pErr.message)
          profiles = (profs || []) as ProfileRow[]
        }

        const nameById = new Map<string, string>()
        profiles.forEach((p) => {
          const nm =
            `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim() ||
            (p.email || '').trim() ||
            'Agent'
          nameById.set(p.id, nm)
        })

        const top5: LeaderRow[] = Array.from(totals.entries())
          .map(([id, premium]) => ({
            id,
            name: nameById.get(id) || 'Agent',
            premium,
          }))
          .sort((a, b) => b.premium - a.premium)
          .slice(0, 5)

        if (!alive) return

        // show logged-in agent first, then real leaderboard below
        const mePremium = totals.get(uid) || 0
        const meRow: LeaderRow = { id: uid, name, premium: mePremium }
        const rest = top5.filter((r) => r.id !== uid)
        setLeaders([meRow, ...rest].slice(0, 5))

        // 4) Recent activity (last 12 deals, show agent name + premium + hour)
        const { data: rec, error: recErr } = await supabase
          .from('deals')
          .select('id, created_at, agent_id, premium')
          .order('created_at', { ascending: false })
          .limit(12)

        if (recErr) throw new Error(recErr.message)

        const recAgentIds = Array.from(
          new Set((rec || []).map((r: any) => (r.agent_id ? String(r.agent_id) : '')).filter(Boolean))
        )

        let recProfiles: ProfileRow[] = []
        if (recAgentIds.length) {
          const { data: rp, error: rpe } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email')
            .in('id', recAgentIds)
          if (rpe) throw new Error(rpe.message)
          recProfiles = (rp || []) as ProfileRow[]
        }

        const recNameById = new Map<string, string>()
        recProfiles.forEach((p) => {
          const nm =
            `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim() ||
            (p.email || '').trim() ||
            'Agent'
          recNameById.set(p.id, nm)
        })

        const recRows = (rec || []).map((r: any) => ({
          id: r.id,
          agent: recNameById.get(String(r.agent_id || '')) || 'Agent',
          premium: Number(r.premium) || 0,
          time: hourLabel(r.created_at),
        }))

        if (!alive) return
        setRecent(recRows)

        setLoading(false)
      } catch (e: any) {
        if (!alive) return
        setToast(e?.message || 'Dashboard error')
        setLoading(false)
      }
    }

    boot()
    return () => {
      alive = false
    }
  }, [dayPick])

  const top5Only = useMemo(() => leaders.slice(0, 5), [leaders])

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
            <p className="text-sm text-white/60 mt-1">Welcome Back {meName || '—'}</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => location.reload()} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        {/* TOP GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* LEFT: snapshot */}
          <div className="xl:col-span-2">
            <div className="glass rounded-2xl border border-white/10 p-6 relative overflow-hidden">
              <div className="absolute top-4 right-4 w-[240px]">
                <FlowDatePicker value={dayPick} onChange={setDayPick} />
              </div>

              <div className="text-xs text-white/60">Production</div>
              <div className="text-2xl font-semibold mt-1">Morning Flow Snapshot</div>
              <div className="text-sm text-white/55 mt-1">Clean signal, no noise.</div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Today’s production</div>
                  <div className="mt-2 text-2xl font-semibold">${fmtMoney(todayProd)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">This weeks production</div>
                  <div className="mt-2 text-2xl font-semibold">${fmtMoney(weekProd)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">This months production</div>
                  <div className="mt-2 text-2xl font-semibold">${fmtMoney(monthProd)}</div>
                </div>
              </div>
            </div>

            {/* FLOW TREND + GOALS (kept minimal / safe) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="glass rounded-2xl border border-white/10 p-6">
                <div className="text-xs text-white/60">Writing agents ✅</div>
                <div className="mt-2 text-3xl font-semibold">{writingAgents}</div>
                <div className="mt-1 text-xs text-white/50">On selected day</div>
              </div>

              <div className="glass rounded-2xl border border-white/10 p-6 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/60">Deals submitted</div>
                    <div className="text-sm font-semibold mt-1">
                      {topCompany?.name || 'No Data'}
                    </div>
                  </div>
                  <TopCarrierDonut
                    label={topCompany?.name || 'No Data'}
                    value={topCompany?.share || 0}
                  />
                </div>
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="glass rounded-2xl border border-white/10 p-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Recent activity</div>
                  <div className="text-xs text-white/55 mt-1">Agent • Premium • Time (hour)</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-3 text-[11px] text-white/55 bg-white/5 px-4 py-3">
                  <div>Agent</div>
                  <div>Premium ✅</div>
                  <div>Time</div>
                </div>

                {loading && <div className="px-4 py-6 text-sm text-white/60">Loading…</div>}

                {!loading && recent.length === 0 && (
                  <div className="px-4 py-6 text-sm text-white/60">No activity yet.</div>
                )}

                {!loading &&
                  recent.map((r) => (
                    <div key={r.id} className="grid grid-cols-3 px-4 py-3 border-t border-white/10">
                      <div className="text-sm font-semibold">{r.agent}</div>
                      <div className="text-sm">${fmtMoney(r.premium)}</div>
                      <div className="text-sm text-white/70">{r.time}</div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* RIGHT: leaderboard preview */}
          <div className="xl:col-span-1">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-white/60">Leaderboard</div>
                  <Link
                    href="/leaderboard"
                    className="text-sm font-semibold mt-1 inline-block hover:underline"
                  >
                    All results →
                  </Link>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-2 text-[11px] text-white/55 bg-white/5 px-4 py-3">
                  <div>Agent</div>
                  <div className="text-right">Premium</div>
                </div>

                {loading && <div className="px-4 py-6 text-sm text-white/60">Loading…</div>}

                {!loading && top5Only.length === 0 && (
                  <div className="px-4 py-6 text-sm text-white/60">No data yet.</div>
                )}

                {!loading &&
                  top5Only.map((r, idx) => (
                    <div key={r.id} className="grid grid-cols-2 px-4 py-3 border-t border-white/10">
                      <div className="text-sm font-semibold">
                        {idx === 0 ? `${r.name} (You)` : r.name}
                      </div>
                      <div className="text-sm text-right">${fmtMoney(r.premium)}</div>
                    </div>
                  ))}
              </div>

              <div className="mt-4 text-xs text-white/45">
                Data window: This month • Updated {isoToPretty(new Date().toISOString())}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
