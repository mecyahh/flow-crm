'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  agent_id: string
  agent_name: string
  agent_email: string
  dayTotals: Record<string, number>
  total: number
}

function money(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function labelMD(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isSunday(d: Date) {
  return d.getDay() === 0
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [days, setDays] = useState<Date[]>([])
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const arr: Date[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      arr.push(d)
    }
    setDays(arr)
    load(arr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load(dayArr: Date[]) {
    setLoading(true)
    setToast(null)

    const start = toISODate(dayArr[0])
    const end = toISODate(new Date(dayArr[dayArr.length - 1].getTime() + 24 * 60 * 60 * 1000))

    // Deals in last 7 days
    const { data: deals, error: dealsErr } = await supabase
      .from('deals')
      .select('id, created_at, agent_id, premium')
      .gte('created_at', start)
      .lt('created_at', end)

    if (dealsErr) {
      setToast('Could not load deals')
      setLoading(false)
      return
    }

    // Agent names
    const agentIds = Array.from(
      new Set((deals || []).map((d: any) => d.agent_id).filter(Boolean))
    )

    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', agentIds.length ? agentIds : ['00000000-0000-0000-0000-000000000000'])

    if (profErr) {
      setToast('Could not load agents')
      setLoading(false)
      return
    }

    const profMap = new Map<string, { name: string; email: string }>()
    ;(profs || []).forEach((p: any) => {
      const name = `${(p.first_name || '').trim()} ${(p.last_name || '').trim()}`.trim()
      profMap.set(p.id, { name: name || p.email || 'Agent', email: p.email || '' })
    })

    const dayKeys = dayArr.map((d) => toISODate(d))

    const map = new Map<string, Row>()
    for (const aId of agentIds) {
      const p = profMap.get(aId)
      const base: Row = {
        agent_id: aId,
        agent_name: p?.name || 'Agent',
        agent_email: p?.email || '',
        dayTotals: Object.fromEntries(dayKeys.map((k) => [k, 0])),
        total: 0,
      }
      map.set(aId, base)
    }

    ;(deals || []).forEach((d: any) => {
      const aId = d.agent_id
      if (!aId) return
      const premium = Number(d.premium || 0)
      if (!Number.isFinite(premium)) return

      const created = new Date(d.created_at)
      const key = toISODate(created)

      const row = map.get(aId)
      if (!row) return
      if (row.dayTotals[key] === undefined) return

      row.dayTotals[key] += premium
      row.total += premium
    })

    const built = Array.from(map.values()).sort((a, b) => b.total - a.total)
    setRows(built)
    setLoading(false)
  }

  const top3 = useMemo(() => rows.slice(0, 3), [rows])

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
            <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-white/60 mt-1">Last 7 days • premium per day</p>
          </div>

          <button
            onClick={() => load(days)}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>

        {/* PODIUM */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* #2 LEFT */}
          {top3[1] ? (
            <div className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden p-6">
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">#2</div>
                  <div className="text-xs text-white/60">Podium</div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold">{top3[1].agent_name}</div>
                  <div className="mt-2 text-2xl font-extrabold">{money(top3[1].total)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50">No data</div>
          )}

          {/* #1 CENTER (bigger + gold spotlight) */}
          {top3[0] ? (
            <div className="relative rounded-2xl border border-white/15 bg-white/6 overflow-hidden p-7 lg:scale-[1.05] shadow-2xl">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[380px] bg-yellow-400/20 blur-3xl rounded-full" />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[420px] h-[240px] bg-yellow-300/18 blur-3xl rounded-full" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">#1</div>
                  <div className="text-xs text-white/60">Podium</div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-extrabold tracking-tight">{top3[0].agent_name}</div>
                  <div className="mt-2 text-4xl font-black tracking-tight">{money(top3[0].total)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50">No data</div>
          )}

          {/* #3 RIGHT */}
          {top3[2] ? (
            <div className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden p-6">
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">#3</div>
                  <div className="text-xs text-white/60">Podium</div>
                </div>
                <div className="mt-3">
                  <div className="text-xl font-bold">{top3[2].agent_name}</div>
                  <div className="mt-2 text-2xl font-extrabold">{money(top3[2].total)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/50">No data</div>
          )}
        </div>

        {/* TABLE */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">Premium by Day</div>
            <div className="text-xs text-white/60">Top 3 also listed below</div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-center text-white/60">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-white/55">
                  <tr className="border-b border-white/10">
                    <th className={th}>Rank</th>
                    <th className={th}>Agent</th>
                    {days.map((d) => (
                      <th key={toISODate(d)} className={thCenter}>
                        {labelMD(d)}
                      </th>
                    ))}
                    <th className={thRight}>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.agent_id} className="border-b border-white/10 hover:bg-white/5 transition">
                      <td className={tdStrong}>{idx + 1}</td>
                      <td className={tdStrong}>{r.agent_name || r.agent_email || 'Agent'}</td>

                      {days.map((d) => {
                        const key = toISODate(d)
                        if (isSunday(d)) {
                          return (
                            <td key={key} className={tdCenterMuted}>
                              — —
                            </td>
                          )
                        }
                        const v = r.dayTotals[key] || 0
                        if (v === 0) {
                          return (
                            <td key={key} className={tdCenterZero}>
                              0
                            </td>
                          )
                        }
                        return (
                          <td key={key} className={tdCenter}>
                            {money(v)}
                          </td>
                        )
                      })}

                      <td className={tdRight}>{money(r.total)}</td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={days.length + 3} className="px-6 py-10 text-center text-white/60">
                        No deals in the last 7 days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thCenter = 'text-center px-4 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'

const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdCenter = 'px-4 py-4 text-center whitespace-nowrap text-white/85'
const tdCenterMuted = 'px-4 py-4 text-center whitespace-nowrap text-white/35 font-semibold'
const tdCenterZero = 'px-4 py-4 text-center whitespace-nowrap font-bold text-red-400'
const tdRight = 'px-6 py-4 text-right whitespace-nowrap font-semibold'
