'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type Deal = {
  id: string
  created_at: string
  agent_id: string
  full_name: string | null
  phone: string | null
  dob: string | null
  company: string | null
  policy_number: string | null
  coverage: number | null
  premium: number | null
  status: string | null
  note: string | null
  notes: string | null

  street_address: string | null
  social: string | null
  routing_number: string | null
  account_number: string | null
}

const STATUS = [
  { v: 'pending', label: 'Pending' },
  { v: 'active', label: 'Active' },
  { v: 'chargeback', label: 'Chargeback' },
  { v: 'potential_lapse', label: 'Potential Lapse' },
  { v: 'lapsed', label: 'Lapsed' },
  { v: 'premium_returned', label: 'Premium Returned' },
] as const

export default function DealHousePage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [rows, setRows] = useState<Deal[]>([])
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<Deal | null>(null)
  const [showNotes, setShowNotes] = useState(false)

  const [folderDeal, setFolderDeal] = useState<Deal | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select(
        'id, created_at, agent_id, full_name, phone, dob, company, policy_number, coverage, premium, status, note, notes, street_address, social, routing_number, account_number'
      )
      .order('created_at', { ascending: false })
      .limit(3000)

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
      const blob = [d.full_name, d.phone, d.company, d.policy_number, d.status, d.dob]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, search])

  async function saveEdit() {
    if (!editing) return

    const payload = {
      full_name: editing.full_name?.trim() || null,
      phone: cleanPhone(editing.phone || ''),
      dob: editing.dob || null,
      company: editing.company?.trim() || null,
      policy_number: editing.policy_number?.trim() || null,
      coverage: toNum(editing.coverage),
      premium: toNum(editing.premium),
      status: (editing.status || 'pending').toLowerCase(),
      note: editing.note || null,
      notes: editing.notes || null,
    }

    const { error } = await supabase.from('deals').update(payload).eq('id', editing.id)
    if (error) {
      setToast('Save failed')
      return
    }

    setEditing(null)
    setShowNotes(false)
    setToast('Saved ✅')
    load()
  }

  async function saveFolder() {
    if (!folderDeal) return

    const payload = {
      street_address: folderDeal.street_address?.trim() || null,
      social: folderDeal.social?.trim() || null,
      routing_number: (folderDeal.routing_number || '').replace(/\s/g, '') || null,
      account_number: (folderDeal.account_number || '').replace(/\s/g, '') || null,
      // keep the same notes fields (uniform small)
      note: folderDeal.note || null,
      notes: folderDeal.notes || null,
    }

    const { error } = await supabase.from('deals').update(payload).eq('id', folderDeal.id)
    if (error) {
      setToast('Save failed')
      return
    }

    setFolderDeal(null)
    setToast('Saved ✅')
    load()
  }

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
            <p className="text-sm text-white/60 mt-1">Clean + editable + folder fields.</p>
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
                placeholder="Search…"
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
                    <th className={th}>Name</th>
                    <th className={th}>Phone</th>
                    <th className={th}>DOB</th>
                    <th className={th}>Company</th>
                    <th className={th}>Policy #</th>
                    <th className={th}>Coverage</th>
                    <th className={th}>Premium</th>
                    <th className={th}>Status</th>
                    <th className={thRight}></th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-white/10 hover:bg-white/5 transition">
                      <td className={tdStrong}>{d.full_name || '—'}</td>
                      <td className={td}>{d.phone || '—'}</td>
                      <td className={td}>{d.dob ? prettyDate(d.dob) : '—'}</td>
                      <td className={td}>{d.company || '—'}</td>
                      <td className={td}>{d.policy_number || '—'}</td>
                      <td className={td}>{d.coverage ? `$${fmtMoney(d.coverage)}` : '—'}</td>
                      <td className={td}>{d.premium ? `$${fmtMoney(d.premium)}` : '—'}</td>
                      <td className={td}>
                        <span className={statusPill(d.status)}>{(d.status || 'pending').toUpperCase()}</span>
                      </td>
                      <td className={tdRight}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditing(d)
                              setShowNotes(false)
                            }}
                            className={iconBtn}
                            title="Edit"
                          >
                            ✏️
                          </button>

                          <button
                            onClick={() => setFolderDeal(d)}
                            className={iconBtn}
                            title="Folder"
                          >
                            📁
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Edit Deal</div>
                <div className="text-xs text-white/55 mt-1">Updates save instantly to Deal House.</div>
              </div>

              <button
                onClick={() => {
                  setEditing(null)
                  setShowNotes(false)
                }}
                className={closeBtn}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={inputCls} value={editing.full_name || ''} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </Field>

              <Field label="Phone Number">
                <input className={inputCls} value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="(888) 888-8888" />
              </Field>

              <Field label="DOB">
                <FlowDatePicker value={editing.dob || ''} onChange={(v) => setEditing({ ...editing, dob: v })} placeholder="Select DOB" />
              </Field>

              <Field label="Company">
                <input className={inputCls} value={editing.company || ''} onChange={(e) => setEditing({ ...editing, company: e.target.value })} />
              </Field>

              <Field label="Policy #">
                <input className={inputCls} value={editing.policy_number || ''} onChange={(e) => setEditing({ ...editing, policy_number: e.target.value })} />
              </Field>

              <Field label="Status">
                <select className={inputCls} value={(editing.status || 'pending').toLowerCase()} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {STATUS.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Coverage">
                <input className={inputCls} value={editing.coverage ?? ''} onChange={(e) => setEditing({ ...editing, coverage: toNum(e.target.value) })} placeholder="100000" />
              </Field>

              <Field label="Premium">
                <input className={inputCls} value={editing.premium ?? ''} onChange={(e) => setEditing({ ...editing, premium: toNum(e.target.value) })} placeholder="100" />
              </Field>
            </div>

            {/* Hidden Notes (uniform) */}
            <div className="mt-5">
              <button
                onClick={() => setShowNotes((s) => !s)}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold w-full flex items-center justify-between"
              >
                <span>Notes</span>
                <span className="text-white/60">{showNotes ? 'Hide' : 'Show'}</span>
              </button>

              {showNotes && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <textarea
                    className={`${inputCls} min-h-[110px]`}
                    value={(editing.note || editing.notes || '')}
                    onChange={(e) => setEditing({ ...editing, note: e.target.value, notes: e.target.value })}
                    placeholder="Notes…"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditing(null)
                  setShowNotes(false)
                }}
                className={closeBtn}
              >
                Cancel
              </button>

              <button onClick={saveEdit} className={saveBtn}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOLDER MODAL */}
      {folderDeal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Folder</div>
                <div className="text-xs text-white/55 mt-1">Extra fields (address, banking, notes).</div>
              </div>

              <button onClick={() => setFolderDeal(null)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Street Address">
                <input
                  className={inputCls}
                  value={folderDeal.street_address || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, street_address: e.target.value })}
                />
              </Field>

              <Field label="Social">
                <input
                  className={inputCls}
                  value={folderDeal.social || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, social: e.target.value })}
                />
              </Field>

              <Field label="Routing Number">
                <input
                  className={inputCls}
                  value={folderDeal.routing_number || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, routing_number: e.target.value })}
                />
              </Field>

              <Field label="Account Number">
                <input
                  className={inputCls}
                  value={folderDeal.account_number || ''}
                  onChange={(e) => setFolderDeal({ ...folderDeal, account_number: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Notes">
                <textarea
                  className={`${inputCls} min-h-[110px]`}
                  value={(folderDeal.note || folderDeal.notes || '')}
                  onChange={(e) => setFolderDeal({ ...folderDeal, note: e.target.value, notes: e.target.value })}
                  placeholder="Notes…"
                />
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setFolderDeal(null)} className={closeBtn}>
                Cancel
              </button>
              <button onClick={saveFolder} className={saveBtn}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* small components + helpers */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function fmtMoney(n: any) {
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function toNum(v: any) {
  if (v === null || v === undefined || v === '') return null
  const num = Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : null
}

function prettyDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

function cleanPhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length !== 10) return raw?.trim() || null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function statusPill(status: string | null) {
  const s = (status || 'pending').toLowerCase()
  if (s === 'active') return 'text-[11px] px-2 py-1 rounded-xl border bg-green-500/12 border-green-400/25 text-green-200'
  if (s === 'chargeback') return 'text-[11px] px-2 py-1 rounded-xl border bg-red-500/12 border-red-400/25 text-red-200'
  if (s === 'pending') return 'text-[11px] px-2 py-1 rounded-xl border bg-yellow-500/12 border-yellow-400/25 text-yellow-200'
  return 'text-[11px] px-2 py-1 rounded-xl border bg-white/6 border-white/12 text-white/70'
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'
const td = 'px-6 py-4 text-white/80 whitespace-nowrap'
const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdRight = 'px-6 py-4 text-right whitespace-nowrap'

const iconBtn =
  'rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs'

const closeBtn =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'
