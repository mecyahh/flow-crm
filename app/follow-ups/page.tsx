'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'
import FlowDateTimePicker from '@/app/components/FlowDateTimePicker'
import NotificationsBell, { pushNotification } from '@/app/components/NotificationsBell'
import { useRouter } from 'next/navigation'

type FollowUp = {
  id: string
  created_at: string
  agent_id: string
  full_name: string | null
  phone: string | null
  client_dob: string | null
  coverage: number | null
  company: string | null
  notes: string | null
  follow_up_at: string | null
  outcome: string | null
}

type Form = {
  full_name: string
  phone: string
  client_dob: string
  coverage: string
  company: string
  notes: string
  follow_up_at: string
}

const QUICK = [
  { k: '24', label: '24hrs', hours: 24 },
  { k: '48', label: '48hrs', hours: 48 },
  { k: 'nw', label: 'Next Week', hours: 24 * 7 },
  { k: 'custom', label: 'Custom', hours: null },
] as const

export default function FollowUpsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [rows, setRows] = useState<FollowUp[]>([])
  const [search, setSearch] = useState('')
  const [quickPick, setQuickPick] = useState<typeof QUICK[number]['k']>('24')

  const [form, setForm] = useState<Form>({
    full_name: '',
    phone: '',
    client_dob: '',
    coverage: '',
    company: '',
    notes: '',
    follow_up_at: '',
  })

  useEffect(() => {
    load()
    applyQuick('24')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('follow_ups')
      .select('id, created_at, agent_id, full_name, phone, client_dob, coverage, company, notes, follow_up_at, outcome')
      .order('follow_up_at', { ascending: true })
      .limit(3000)

    if (error) {
      setToast('Could not load Follow Ups (RLS)')
      setLoading(false)
      return
    }

    setRows((data || []) as FollowUp[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const blob = [r.full_name, r.phone, r.company, r.notes, r.client_dob, r.outcome]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, search])

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  function applyQuick(k: typeof QUICK[number]['k']) {
    setQuickPick(k)
    if (k === 'custom') return

    const spec = QUICK.find((x) => x.k === k)!
    const d = new Date(Date.now() + (spec.hours || 0) * 3600 * 1000)
    const iso = `${toISO(d)}T${toHM(d)}:00.000Z`
    set('follow_up_at', iso)
  }

  async function submit() {
    const userRes = await supabase.auth.getUser()
    const uid = userRes.data.user?.id
    if (!uid) return

    const payload = {
      agent_id: uid,
      full_name: form.full_name.trim() || null,
      phone: cleanPhone(form.phone),
      client_dob: form.client_dob || null,
      coverage: toNum(form.coverage),
      company: form.company.trim() || null,
      notes: form.notes.trim() || null,
      follow_up_at: form.follow_up_at || null,
      outcome: 'follow_up',
    }

    const { error } = await supabase.from('follow_ups').insert(payload)
    if (error) {
      setToast('Submit failed')
      return
    }

    setToast('Submitted ✅')
    setForm({ full_name: '', phone: '', client_dob: '', coverage: '', company: '', notes: '', follow_up_at: '' })
    setQuickPick('24')
    load()
  }

  async function setOutcome(id: string, outcome: 'follow_up' | 'denied_coverage') {
    const { error } = await supabase.from('follow_ups').update({ outcome }).eq('id', id)
    if (error) {
      setToast('Update failed')
      return
    }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, outcome } : r)))
  }

  function goCloseDeal(followUpId: string) {
    router.push(`/close-deal/${followUpId}`)
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
            <h1 className="text-3xl font-semibold tracking-tight">Follow Ups</h1>
            <p className="text-sm text-white/60 mt-1">Simple form + due list + outcomes.</p>
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

            <NotificationsBell />

            <button onClick={load} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        {/* FORM */}
        <div className="glass rounded-2xl border border-white/10 p-6 mb-6">
          <div className="text-sm font-semibold mb-4">Submit a Follow Up</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name">
              <input className={inputCls} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
            </Field>

            <Field label="Phone">
              <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(888) 888-8888" />
            </Field>

            <Field label="Client DOB">
              <FlowDatePicker value={form.client_dob} onChange={(v) => set('client_dob', v)} placeholder="Select DOB" />
            </Field>

            <Field label="Company">
              <input className={inputCls} value={form.company} onChange={(e) => set('company', e.target.value)} />
            </Field>

            <Field label="Coverage">
              <input className={inputCls} value={form.coverage} onChange={(e) => set('coverage', e.target.value)} placeholder="100000" />
            </Field>

            <Field label="Follow Up Date/Time">
              <FlowDateTimePicker value={form.follow_up_at} onChange={(v) => set('follow_up_at', v)} />
            </Field>
          </div>

          <Field label="Notes" className="mt-4">
            <textarea className={`${inputCls} min-h-[120px]`} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q.k}
                onClick={() => applyQuick(q.k)}
                className={[
                  'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                  quickPick === q.k ? 'bg-green-600 border-green-500/60 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10',
                ].join(' ')}
              >
                {q.label}
              </button>
            ))}
          </div>

          <button onClick={submit} className="mt-5 w-full rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-3 text-sm font-semibold">
            Submit
          </button>
        </div>

        {/* LIST */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">Due</div>
            <div className="text-xs text-white/60">{filtered.length.toLocaleString()} items</div>
          </div>

          {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="px-6 py-10 text-center text-white/60">No follow ups yet.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] text-white/55">
                  <tr className="border-b border-white/10">
                    <th className={th}>Name</th>
                    <th className={th}>Phone</th>
                    <th className={th}>Company</th>
                    <th className={th}>Follow Up</th>
                    <th className={th}>Outcome</th>
                    <th className={thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const due = r.follow_up_at ? new Date(r.follow_up_at).getTime() <= Date.now() : false

                    if (due && typeof window !== 'undefined') {
                      const key = `due_${r.id}`
                      const already = localStorage.getItem(key)
                      if (!already) {
                        localStorage.setItem(key, '1')
                        pushNotification({
                          id: r.id,
                          title: 'Follow Up Due Now',
                          body: `Call ${r.full_name || 'client'} back`,
                          href: '/follow-ups',
                        })
                        playChime()
                      }
                    }

                    return (
                      <tr key={r.id} className="border-b border-white/10 hover:bg-white/5 transition">
                        <td className={tdStrong}>{r.full_name || '—'}</td>
                        <td className={td}>{r.phone || '—'}</td>
                        <td className={td}>{r.company || '—'}</td>
                        <td className={td}>
                          <span className={due ? 'text-red-200' : 'text-white/80'}>
                            {r.follow_up_at ? new Date(r.follow_up_at).toLocaleString() : '—'}
                          </span>
                        </td>
                        <td className={td}>
                          <span className={pill(r.outcome)}>{(r.outcome || 'follow_up').toUpperCase()}</span>
                        </td>
                        <td className={tdRight}>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => goCloseDeal(r.id)}
                              className="rounded-2xl border border-white/10 bg-green-600/20 hover:bg-green-600/30 transition px-3 py-2 text-xs font-semibold"
                            >
                              Closed Deal
                            </button>
                            <button
                              onClick={() => setOutcome(r.id, 'follow_up')}
                              className="rounded-2xl border border-white/10 bg-yellow-600/20 hover:bg-yellow-600/30 transition px-3 py-2 text-xs font-semibold"
                            >
                              Follow Up
                            </button>
                            <button
                              onClick={() => setOutcome(r.id, 'denied_coverage')}
                              className="rounded-2xl border border-white/10 bg-red-600/20 hover:bg-red-600/30 transition px-3 py-2 text-xs font-semibold"
                            >
                              Denied
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function playChime() {
  const audio = new Audio('/chime.mp3')
  audio.volume = 0.9
  audio.play().catch(() => {})
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className || ''}>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function toNum(v: any) {
  if (v === null || v === undefined || v === '') return null
  const num = Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : null
}

function cleanPhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length !== 10) return raw?.trim() || null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function pill(outcome: string | null) {
  const o = (outcome || 'follow_up').toLowerCase()
  if (o === 'closed_deal') return 'text-[11px] px-2 py-1 rounded-xl border bg-green-500/12 border-green-400/25 text-green-200'
  if (o === 'denied_coverage') return 'text-[11px] px-2 py-1 rounded-xl border bg-red-500/12 border-red-400/25 text-red-200'
  return 'text-[11px] px-2 py-1 rounded-xl border bg-yellow-500/12 border-yellow-400/25 text-yellow-200'
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toHM(d: Date) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const th = 'text-left px-6 py-3 whitespace-nowrap'
const thRight = 'text-right px-6 py-3 whitespace-nowrap'
const td = 'px-6 py-4 text-white/80 whitespace-nowrap'
const tdStrong = 'px-6 py-4 font-semibold whitespace-nowrap'
const tdRight = 'text-right px-6 py-4 whitespace-nowrap'
