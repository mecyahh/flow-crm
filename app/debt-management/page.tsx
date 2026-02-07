// ✅ REPLACE ENTIRE FILE: /app/debt-management/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import GlassSelect from '@/app/components/GlassSelect'

type DebtCase = {
  id: string
  agent_id: string
  full_name: string
  phone: string | null
  creditor: string
  account_last4: string | null
  balance: any
  monthly_payment: any
  interest_rate: any
  status: string
  source: string
  note: string | null
  created_at: string
  updated_at: string
}

const STATUS_OPTS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'settled', label: 'Settled' },
  { value: 'charged_off', label: 'Charged Off' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'lost', label: 'Lost' },
]

const SOURCE_OPTS = [
  { value: 'Inbound', label: 'Inbound' },
  { value: 'Readymode', label: 'Readymode' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Warm-Market', label: 'Warm-Market' },
]

export default function DebtManagementPage() {
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DebtCase[]>([])

  // filters
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [source, setSource] = useState<string>('all')

  // create form
  const [openNew, setOpenNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const [full_name, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [creditor, setCreditor] = useState('')
  const [account_last4, setLast4] = useState('')
  const [balance, setBalance] = useState('')
  const [monthly_payment, setMonthlyPayment] = useState('')
  const [interest_rate, setInterestRate] = useState('')
  const [newStatus, setNewStatus] = useState('open')
  const [newSource, setNewSource] = useState('Inbound')
  const [note, setNote] = useState('')

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)

    const { data: u } = await supabase.auth.getUser()
    if (!u.user?.id) {
      window.location.href = '/login'
      return
    }

    await load()
  }

  async function load() {
    setToast(null)
    setLoading(true)

    const { data, error } = await supabase
      .from('debt_cases')
      .select(
        'id,agent_id,full_name,phone,creditor,account_last4,balance,monthly_payment,interest_rate,status,source,note,created_at,updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error) {
      setRows([])
      setToast(error.message || 'Could not load debt cases')
      setLoading(false)
      return
    }

    setRows((data || []) as DebtCase[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      const matchesQ =
        !needle ||
        String(r.full_name || '').toLowerCase().includes(needle) ||
        String(r.phone || '').toLowerCase().includes(needle) ||
        String(r.creditor || '').toLowerCase().includes(needle)

      const matchesStatus = status === 'all' ? true : r.status === status
      const matchesSource = source === 'all' ? true : r.source === source

      return matchesQ && matchesStatus && matchesSource
    })
  }, [rows, q, status, source])

  const totals = useMemo(() => {
    const bal = filtered.reduce((s, r) => s + toNum(r.balance), 0)
    const pay = filtered.reduce((s, r) => s + toNum(r.monthly_payment), 0)
    return { bal, pay }
  }, [filtered])

  async function createCase() {
    if (saving) return
    setToast(null)

    const nameClean = full_name.trim()
    const credClean = creditor.trim()
    if (!nameClean) return setToast('Client name is required')
    if (!credClean) return setToast('Creditor is required')

    const bal = toNum(balance)
    if (!Number.isFinite(bal) || bal < 0) return setToast('Balance must be a valid number')

    const mp = monthly_payment.trim() ? toNum(monthly_payment) : null
    if (monthly_payment.trim() && (!Number.isFinite(mp as any) || (mp as any) < 0))
      return setToast('Monthly payment must be a valid number')

    const ir = interest_rate.trim() ? toNum(interest_rate) : null
    if (interest_rate.trim() && (!Number.isFinite(ir as any) || (ir as any) < 0))
      return setToast('Interest rate must be a valid number')

    const last4 = account_last4.trim()
    if (last4 && last4.replace(/\D/g, '').length !== 4) return setToast('Account last 4 must be 4 digits')

    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) {
        window.location.href = '/login'
        return
      }

      const payload: any = {
        agent_id: uid,
        user_id: uid,
        full_name: nameClean,
        phone: normalizePhone(phone) || null,
        creditor: credClean,
        account_last4: last4 ? last4.replace(/\D/g, '').slice(0, 4) : null,
        balance: bal,
        monthly_payment: mp,
        interest_rate: ir,
        status: newStatus,
        source: newSource,
        note: note.trim() || null,
      }

      const { error } = await supabase.from('debt_cases').insert(payload)
      if (error) throw new Error(error.message)

      setOpenNew(false)
      resetForm()
      await load()
    } catch (e: any) {
      setToast(e?.message || 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setFullName('')
    setPhone('')
    setCreditor('')
    setLast4('')
    setBalance('')
    setMonthlyPayment('')
    setInterestRate('')
    setNewStatus('open')
    setNewSource('Inbound')
    setNote('')
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
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

      <div className="w-full min-w-0 px-4 py-6 md:px-10 md:py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Debt Management</h1>
            <p className="text-sm text-white/60 mt-1">Track debt cases, balances, and monthly payments.</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => load()} className={btnGlass}>
              Refresh
            </button>
            <button
              onClick={() => {
                setOpenNew(true)
                setToast(null)
              }}
              className="rounded-2xl px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 transition"
            >
              + New Case
            </button>
          </div>
        </div>

        {/* Filters + Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold mb-2">Search</div>
            <input
              className={inputCls}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name / phone / creditor…"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <div className="text-[11px] text-white/55 mb-2">Status</div>
                <GlassSelect
                  value={status}
                  onChange={(v) => setStatus(v)}
                  options={[{ value: 'all', label: 'All' }, ...STATUS_OPTS]}
                />
              </div>
              <div>
                <div className="text-[11px] text-white/55 mb-2">Source</div>
                <GlassSelect
                  value={source}
                  onChange={(v) => setSource(v)}
                  options={[{ value: 'all', label: 'All' }, ...SOURCE_OPTS]}
                />
              </div>
            </div>
          </div>

          <MiniStat label="Total Balance" value={loading ? '—' : `$${money(totals.bal)}`} />
          <MiniStat label="Total Monthly Payments" value={loading ? '—' : `$${money(totals.pay)}`} />
        </div>

        {/* Table */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-6 px-4 py-3 text-xs text-white/60 bg-white/5 border-b border-white/10">
            <div className="col-span-2 truncate">Client</div>
            <div className="truncate">Creditor</div>
            <div className="text-right truncate">Balance</div>
            <div className="text-right truncate">Monthly</div>
            <div className="text-right truncate">Status</div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-center text-white/60">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-white/60">No cases found.</div>
          ) : (
            filtered.slice(0, 250).map((r) => (
              <div key={r.id} className="grid grid-cols-6 px-4 py-3 border-b border-white/10 text-sm">
                <div className="col-span-2 truncate">
                  <div className="font-semibold truncate">{r.full_name}</div>
                  <div className="text-xs text-white/55 truncate">{r.phone || '—'} • {r.source}</div>
                </div>
                <div className="truncate">{r.creditor}</div>
                <div className="text-right truncate">${money(toNum(r.balance))}</div>
                <div className="text-right truncate">${money(toNum(r.monthly_payment))}</div>
                <div className="text-right truncate">
                  <span className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs">
                    {prettyStatus(r.status)}
                  </span>
                </div>
              </div>
            ))
          )}

          {!loading && filtered.length > 250 && (
            <div className="px-4 py-3 text-xs text-white/55">Showing first 250 results.</div>
          )}
        </div>
      </div>

      {/* New Case Modal */}
      {openNew && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/70" onClick={() => !saving && setOpenNew(false)} />
          <div className="absolute inset-x-4 top-10 md:inset-x-0 md:left-1/2 md:-translate-x-1/2 md:w-[760px]">
            <div className="glass rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">New Debt Case</div>
                  <div className="text-xs text-white/55 mt-0.5">Creates a new case for the signed-in agent only.</div>
                </div>
                <button className={btnSoft} onClick={() => !saving && setOpenNew(false)}>
                  Close
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Client Name">
                  <input className={inputCls} value={full_name} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
                </Field>

                <Field label="Phone">
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(888) 888-8888" />
                </Field>

                <Field label="Creditor">
                  <input className={inputCls} value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="Chase, Amex, etc…" />
                </Field>

                <Field label="Account Last 4">
                  <input className={inputCls} value={account_last4} onChange={(e) => setLast4(e.target.value)} placeholder="1234" inputMode="numeric" />
                </Field>

                <Field label="Balance">
                  <input className={inputCls} value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="15000" inputMode="decimal" />
                </Field>

                <Field label="Monthly Payment">
                  <input className={inputCls} value={monthly_payment} onChange={(e) => setMonthlyPayment(e.target.value)} placeholder="450" inputMode="decimal" />
                </Field>

                <Field label="Interest Rate (%)">
                  <input className={inputCls} value={interest_rate} onChange={(e) => setInterestRate(e.target.value)} placeholder="19.99" inputMode="decimal" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-white/55 mb-2">Status</div>
                    <GlassSelect value={newStatus} onChange={(v) => setNewStatus(v)} options={STATUS_OPTS} />
                  </div>
                  <div>
                    <div className="text-[11px] text-white/55 mb-2">Source</div>
                    <GlassSelect value={newSource} onChange={(v) => setNewSource(v)} options={SOURCE_OPTS} />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="text-[11px] text-white/55 mb-2">Notes</div>
                  <textarea
                    className={textAreaCls}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional notes…"
                    rows={4}
                  />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                  <button className={btnGlass} onClick={() => !saving && setOpenNew(false)}>
                    Cancel
                  </button>
                  <button
                    onClick={createCase}
                    disabled={saving}
                    className={[
                      'rounded-2xl px-4 py-2 text-sm font-semibold transition',
                      saving ? 'bg-white/10 border border-white/10 text-white/60 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500',
                    ].join(' ')}
                  >
                    {saving ? 'Saving…' : 'Create Case'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- UI ---------- */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl border border-white/10 p-6">
      <p className="text-sm text-white/60">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

/* ---------- helpers ---------- */

function toNum(v: any) {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string'
      ? Number(v.replace(/[^0-9.]/g, ''))
      : Number(v || 0)
  return Number.isFinite(n) ? n : 0
}

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function prettyStatus(s: string) {
  const m: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    settled: 'Settled',
    charged_off: 'Charged Off',
    disputed: 'Disputed',
    lost: 'Lost',
  }
  return m[s] || s
}

function normalizePhone(input: string) {
  const digits = String(input || '').replace(/\D/g, '').slice(0, 10)
  if (!digits) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7 text-white placeholder:text-white/45'
const textAreaCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7 text-white placeholder:text-white/45 resize-none'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
