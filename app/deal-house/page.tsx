'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Deal = {
  id: string
  created_at: string
  agent_id: string
  full_name: string | null
  company: string | null
  policy_number: string | null
  coverage: number | null
  premium: number | null
  dob: string | null
  beneficiary_name: string | null
  note: string | null
}

export default function DealHousePage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [rows, setRows] = useState<Deal[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const { data, error } = await supabase
      .from('deals')
      .select('id, created_at, agent_id, full_name, company, policy_number, coverage, premium, dob, beneficiary_name, note')
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error) {
      setToast('Could not load Deal House (RLS)')
      setLoading(false)
      return
    }

    setRows((data || []) as Deal[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows

    return rows.filter((d) => {
      const blob = [
        d.full_name,
        d.company,
        d.policy_number,
        d.beneficiary_name,
        d.note,
        d.dob,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, search])

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
            <h1 className="text-3xl font-semibold tracking-tight">Deal House</h1>
            <p className="text-sm text-white/60 mt-1">Clean view of submitted deals.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="glass rounded-2xl border border-white/10 px-3 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.5 1 4-4"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="bg-transparent outline-none text-sm w-72 placeholder:text-white/40"
                placeholder="Search name, carrier, policy #…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button onClick={load} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">All Deals</div>
            <div className="text-xs text-white/60">{filtered.length.toLocaleString()} records</div>
          </div>

          {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-white/60">No deals yet.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-white/55">
                  <tr className="border-b border-white/10">
                    <th className={th}>Full Name</th>
                    <th className={th}>Company</th>
                    <th className={th}>Policy #</th>
                    <th className={th}>Coverage</th>
                    <th className={th}>DOB</th>
                    <th className={th}>Beneficiary</th>
                    <th className={th}>Note</th>
                    <th className={thRight}>Submitted</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-white/10 hover:bg-white/5 transition">
                      <td className={tdStrong}>{d.full_name || '—'}</td>
                      <td className={td}>{d.company || '—'}</td>
                      <td className={td}>{d.policy_number || '—'}</td>
                      <td className={td}>{d.coverage ? `$${fmtMoney(d.coverage)}` : '—'}</td>
                      <td className={td}>{d.dob ? fmtDate(d.dob) : '—'}</td>
                      <td className={td}>{d.beneficiary_name || '—'}</td>
                      <td className={tdClamp}>{d.note || '—'}</td>
                      <td className={tdRight}>{new Date(d.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* helpers + styles */

function fmtMoney(n: number) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })
}
function fmtDate(iso: string) {
  // accept date or datetime
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'
const td = 'px-6 py-4 text-white/80 whitespace-nowrap'
const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdRight = 'px-6 py-4 text-right text-white/70 whitespace-nowrap'
const tdClamp = 'px-6 py-4 text-white/75 max-w-[360px] truncate'
