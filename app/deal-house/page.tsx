// ✅ FILE: /app/deal-house/page.tsx  (REPLACE ENTIRE FILE)
// Fixes "Loading…" (robust load + always ends loading)
// Adds Personal/Team tabs (Personal = yellow, Team = fuchsia)
// Team tab = uplines inherit ALL downlines deals (recursive tree)

'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type Profile = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_agency_owner: boolean | null
  upline_id: string | null
}

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

type Tab = 'personal' | 'team'

export default function DealHousePage() {
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [me, setMe] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [rows, setRows] = useState<Deal[]>([])
  const [search, setSearch] = useState('')

  const [tab, setTab] = useState<Tab>('personal')

  const [editing, setEditing] = useState<Deal | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [folderDeal, setFolderDeal] = useState<Deal | null>(null)

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)
    setToast(null)

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw new Error(`auth.getUser: ${userErr.message}`)
      const uid = userRes.user?.id
      if (!uid) {
        window.location.href = '/login'
        return
      }

      const { data: myProf, error: myProfErr } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,role,is_agency_owner,upline_id')
        .eq('id', uid)
        .single()

      if (myProfErr || !myProf) throw new Error('Could not load profile')

      const my = myProf as Profile
      setMe(my)

      // Load all profiles (needed to compute downline tree)
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,role,is_agency_owner,upline_id')
        .limit(10000)

      if (profErr) throw new Error('Could not load profiles')

      const list = (profs || []) as Profile[]
      setProfiles(list)

      // Default tab:
      // - agents start on personal
      // - owners/admins start on team
      const isOwner = !!my.is_agency_owner || (my.role || '').toLowerCase() === 'admin'
      setTab(isOwner ? 'team' : 'personal')

      setLoading(false)
    } catch (e: any) {
      setToast(e?.message || 'Boot failed')
      setLoading(false)
    }
  }

  // Build downline closure (recursive)
  const downlineIds = useMemo(() => {
    if (!me) return []
    const childrenByUpline = new Map<string, string[]>()
    for (const p of profiles) {
      if (!p.upline_id) continue
      if (!childrenByUpline.has(p.upline_id)) childrenByUpline.set(p.upline_id, [])
      childrenByUpline.get(p.upline_id)!.push(p.id)
    }

    const out: string[] = []
    const q: string[] = [me.id]
    const seen = new Set<string>([me.id])

    while (q.length) {
      const cur = q.shift()!
      const kids = childrenByUpline.get(cur) || []
      for (const kid of kids) {
        if (seen.has(kid)) continue
        seen.add(kid)
        out.push(kid)
        q.push(kid)
      }
    }
    return out
  }, [me, profiles])

  const canSeeTeam = useMemo(() => {
    if (!me) return false
    const role = (me.role || '').toLowerCase()
    return !!me.is_agency_owner || role === 'admin' || downlineIds.length > 0
  }, [me, downlineIds.length])

  const teamAgentIds = useMemo(() => {
    if (!me) return []
    // team view includes self + downlines
    return [me.id, ...downlineIds]
  }, [me, downlineIds])

  useEffect(() => {
    if (!me) return
    loadDeals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, profiles.length])

  async function loadDeals() {
    setLoading(true)
    setToast(null)

    try {
      if (!me) return

      const ids = tab === 'team' && canSeeTeam ? teamAgentIds : [me.id]

      // if team tab selected but not allowed, fall back
      if (tab === 'team' && !canSeeTeam) {
        setTab('personal')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('deals')
        .select(
          'id, created_at, agent_id, full_name, phone, dob, company, policy_number, coverage, premium, status, note, notes, street_address, social, routing_number, account_number'
        )
        .in('agent_id', ids)
        .order('created_at', { ascending: false })
        .limit(3000)

      if (error) throw new Error('Could not load Deal House (RLS)')

      setRows((data || []) as Deal[])
      setLoading(false)
    } catch (e: any) {
      setRows([])
      setToast(e?.message || 'Load failed')
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((d) => {
      const blob = [
        d.full_name,
        d.phone,
        d.company,
        d.policy_number,
        d.status,
        d.dob,
        agentName(d.agent_id, profiles),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, search, profiles])

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
    if (error) return setToast('Save failed')

    setEditing(null)
    setShowNotes(false)
    setToast('Saved ✅')
    loadDeals()
  }

  async function saveFolder() {
    if (!folderDeal) return

    const payload = {
      street_address: folderDeal.street_address?.trim() || null,
      social: folderDeal.social?.trim() || null,
      routing_number: (folderDeal.routing_number || '').replace(/\s/g, '') || null,
      account_number: (folderDeal.account_number || '').replace(/\s/g, '') || null,
      note: folderDeal.note || null,
      notes: folderDeal.notes || null,
    }

    const { error } = await supabase.from('deals').update(payload).eq('id', folderDeal.id)
    if (error) return setToast('Save failed')

    setFolderDeal(null)
    setToast('Saved ✅')
    loadDeals()
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-[var(--border)] shadow-2xl">
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
            <p className="text-sm text-[var(--text)]/60 mt-1">
              {tab === 'team' ? 'Team view (you + downlines)' : 'Personal view (your deals only)'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs (top right) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTab('personal')}
                className={[
                  'rounded-2xl px-4 py-2 text-sm font-semibold border transition',
                  tab === 'personal'
                    ? 'bg-yellow-500/20 border-yellow-400/35 text-yellow-100'
                    : 'bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--panel2)] text-[var(--text)]/80',
                ].join(' ')}
              >
                Personal
              </button>

              <button
                onClick={() => setTab('team')}
                disabled={!canSeeTeam}
                className={[
                  'rounded-2xl px-4 py-2 text-sm font-semibold border transition',
                  tab === 'team'
                    ? 'bg-fuchsia-500/20 border-fuchsia-400/35 text-fuchsia-100'
                    : 'bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--panel2)] text-[var(--text)]/80',
                  !canSeeTeam ? 'opacity-40 cursor-not-allowed hover:bg-[var(--panel)]' : '',
                ].join(' ')}
                title={!canSeeTeam ? 'No downlines assigned yet' : 'Team'}
              >
                Team
              </button>
            </div>

            <div className="glass rounded-2xl border border-[var(--border)] px-3 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.5 1 4-4"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className="bg-transparent outline-none text-sm w-72 placeholder:text-[var(--text)]/40"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button onClick={loadDeals} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
          <div className="px-6 py-4 bg-[var(--panel)] flex items-center justify-between">
            <div className="text-sm font-semibold">All Deals</div>
            <div className="text-xs text-[var(--text)]/60">{loading ? 'Loading…' : `${filtered.length.toLocaleString()} records`}</div>
          </div>

          {loading && <div className="px-6 py-10 text-center text-[var(--text)]/60">Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-[var(--text)]/60">No deals yet.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-[var(--text)]/55">
                  <tr className="border-b border-[var(--border)]">
                    {tab === 'team' && <th className={th}>Agent</th>}
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
                    <tr key={d.id} className="border-b border-[var(--border)] hover:bg-[var(--panel)] transition">
                      {tab === 'team' && <td className={td}>{agentName(d.agent_id, profiles)}</td>}
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

                          <button onClick={() => setFolderDeal(d)} className={iconBtn} title="Folder">
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
        <div className="fixed inset-0 bg-[var(--bg)]/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-[var(--border)] p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Edit Deal</div>
                <div className="text-xs text-[var(--text)]/55 mt-1">Updates save instantly to Deal House.</div>
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
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-4 py-3 text-sm font-semibold w-full flex items-center justify-between"
              >
                <span>Notes</span>
                <span className="text-[var(--text)]/60">{showNotes ? 'Hide' : 'Show'}</span>
              </button>

              {showNotes && (
                <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
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
        <div className="fixed inset-0 bg-[var(--bg)]/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-[var(--border)] p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Folder</div>
                <div className="text-xs text-[var(--text)]/55 mt-1">Extra fields (address, banking, notes).</div>
              </div>

              <button onClick={() => setFolderDeal(null)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Street Address">
                <input className={inputCls} value={folderDeal.street_address || ''} onChange={(e) => setFolderDeal({ ...folderDeal, street_address: e.target.value })} />
              </Field>

              <Field label="Social">
                <input className={inputCls} value={folderDeal.social || ''} onChange={(e) => setFolderDeal({ ...folderDeal, social: e.target.value })} />
              </Field>

              <Field label="Routing Number">
                <input className={inputCls} value={folderDeal.routing_number || ''} onChange={(e) => setFolderDeal({ ...folderDeal, routing_number: e.target.value })} />
              </Field>

              <Field label="Account Number">
                <input className={inputCls} value={folderDeal.account_number || ''} onChange={(e) => setFolderDeal({ ...folderDeal, account_number: e.target.value })} />
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

/* ---------- helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--text)]/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function agentName(agentId: string, profiles: Profile[]) {
  const p = profiles.find((x) => x.id === agentId)
  if (!p) return '—'
  const n = `${p.first_name || ''} ${p.last_name || ''}`.trim()
  return n || p.email || 'Agent'
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
  return 'text-[11px] px-2 py-1 rounded-xl border bg-white/6 border-white/12 text-[var(--text)]/70'
}

const inputCls =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-[var(--panel2)] transition rounded-2xl border border-[var(--border)]'
const btnSoft = 'rounded-xl bg-[var(--panel2)] hover:bg-white/15 transition px-3 py-2 text-xs'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'
const td = 'px-6 py-4 text-[var(--text)]/80 whitespace-nowrap'
const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdRight = 'px-6 py-4 text-right whitespace-nowrap'

const iconBtn =
  'rounded-xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-3 py-2 text-xs'

const closeBtn =
  'rounded-2xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'rounded-2xl bg-green-600 hover:bg-green-500 transition px-5 py-3 text-sm font-semibold'
