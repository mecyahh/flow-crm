// FILE: /app/follow-ups/ui.tsx
// ACTION: CREATE THIS FILE (NEW) AND PASTE ENTIRE CODE

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import FlowDatePicker from '@/app/components/FlowDatePicker'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type FollowUp = {
  id: string
  created_at: string
  agent_id: string
  full_name: string | null
  phone: string | null
  dob: string | null
  company: string | null
  coverage: number | null
  follow_up_at: string | null
  notes: string | null
  status: 'upcoming' | 'due' | 'completed' | 'denied'
}

const CARRIERS = [
  'Aetna',
  'Aflac',
  'AIG',
  'American Amicable',
  'Mutual Of Omaha',
  'Royal Neighbors',
  'Transamerica',
] as const

export default function FollowUpsClient() {
  const [toast, setToast] = useState<string | null>(null)
  const [rows, setRows] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [alertsOn, setAlertsOn] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    dob: '',
    company: '',
    coverage: '',
    follow_up_at: '',
    notes: '',
  })

  const [preset, setPreset] = useState<'24' | '48' | 'week' | 'custom' | ''>('')

  const chimeRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    chimeRef.current = typeof Audio !== 'undefined' ? new Audio('/chime.mp3') : null
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) {
      setToast('Not logged in')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('follow_ups')
      .select('id, created_at, agent_id, full_name, phone, dob, company, coverage, follow_up_at, notes, status')
      .eq('agent_id', uid)
      .order('follow_up_at', { ascending: true })
      .limit(3000)

   if (error) {
  setToast(`Could not load follow ups: ${error.message}`)
  setLoading(false)
  return
}

    setRows((data || []) as FollowUp[])
    setLoading(false)
  }

  const now = Date.now()

  const counts = useMemo(() => {
    const due = rows.filter((r) => (r.status === 'due' || r.status === 'upcoming') && isDue(r.follow_up_at, now)).length
    const upcoming = rows.filter((r) => (r.status === 'due' || r.status === 'upcoming') && !isDue(r.follow_up_at, now)).length
    const all = rows.filter((r) => r.status === 'due' || r.status === 'upcoming').length
    const completed = rows.filter((r) => r.status === 'completed' || r.status === 'denied').length
    return { due, upcoming, all, completed }
  }, [rows, now])

  const dueNowList = useMemo(
    () => rows.filter((r) => (r.status === 'due' || r.status === 'upcoming') && isDue(r.follow_up_at, now)),
    [rows, now]
  )

  const upcomingList = useMemo(
    () => rows.filter((r) => (r.status === 'due' || r.status === 'upcoming') && !isDue(r.follow_up_at, now)),
    [rows, now]
  )

  useEffect(() => {
    if (!alertsOn) return
    if (dueNowList.length === 0) return

    try {
      chimeRef.current?.play().catch(() => {})
    } catch {}

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsOn, dueNowList.length])

  function applyPreset(p: '24' | '48' | 'week' | 'custom') {
    setPreset(p)
    if (p === 'custom') return

    const base = new Date()
    if (p === '24') base.setHours(base.getHours() + 24)
    if (p === '48') base.setHours(base.getHours() + 48)
    if (p === 'week') base.setDate(base.getDate() + 7)

    setForm((f) => ({ ...f, follow_up_at: toLocalInput(base) }))
  }

  async function submit() {
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) return setToast('Not logged in')

    const payload = {
      agent_id: uid,
      full_name: form.full_name.trim() || null,
      phone: cleanPhone(form.phone),
      dob: form.dob || null,
      company: form.company || null,
      coverage: toNum(form.coverage),
      follow_up_at: form.follow_up_at ? new Date(form.follow_up_at + 'T00:00:00').toISOString() : null,
      notes: form.notes.trim() || null,
      status: 'upcoming',
    }

    const { error } = await supabase.from('follow_ups').insert(payload)
    if (error) return setToast('Submit failed')

    setToast('Follow up submitted ✅')
    setForm({ full_name: '', phone: '', dob: '', company: '', coverage: '', follow_up_at: '', notes: '' })
    setPreset('')
    load()
  }

  async function setStatus(id: string, status: FollowUp['status']) {
    const { error } = await supabase.from('follow_ups').update({ status }).eq('id', id)
    if (error) return setToast('Update failed')
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
            <h1 className="text-3xl font-semibold tracking-tight">Follow Ups</h1>
            <p className="text-sm text-white/60 mt-1">Fast. Simple. No deals slipping.</p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setAlertsOn((v) => !v)} className={alertsOn ? btnGreen : btnGlass}>
              {alertsOn ? 'Alerts ON' : 'Enable Alerts'}
            </button>
            <button onClick={load} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Due Now" value={counts.due} />
          <Stat label="Upcoming" value={counts.upcoming} />
          <Stat label="All" value={counts.all} />
          <Stat label="Completed" value={counts.completed} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FORM */}
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold mb-4">Submit a Follow Up</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={inputCls} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </Field>

              <Field label="Phone">
                <input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: cleanPhone(e.target.value) || '' }))} placeholder="(888) 888-8888" />
              </Field>

             <Field label="Client DOB">
  <FlowDatePicker
    value={form.dob}
    onChange={(v) => setForm((f) => ({ ...f, dob: v }))}
    placeholder="Select DOB"
  />
</Field>
              <Field label="Company">
                <select className={inputCls} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}>
                  <option value="">Select…</option>
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Coverage">
                <input className={inputCls} value={form.coverage} onChange={(e) => setForm((f) => ({ ...f, coverage: e.target.value }))} placeholder="100000" />
              </Field>

            <Field label="Follow Up Date">
  <FlowDatePicker
    value={form.follow_up_date}
    onChange={(v) => {
      setPreset('custom')
      setForm((f) => ({ ...f, follow_up_date: v }))
    }}
    placeholder="Select date"
  />
</Field>

<Field label="Follow Up Time">
  <input
    type="time"
    className={inputCls}
    value={form.follow_up_time}
    onChange={(e) => {
      setPreset('custom')
      setForm((f) => ({ ...f, follow_up_time: e.target.value }))
    }}
  />
</Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => applyPreset('24')} className={preset === '24' ? btnGreen : btnGlass}>
                24hrs
              </button>
              <button onClick={() => applyPreset('48')} className={preset === '48' ? btnGreen : btnGlass}>
                48hrs
              </button>
              <button onClick={() => applyPreset('week')} className={preset === 'week' ? btnGreen : btnGlass}>
                Next Week
              </button>
              <button onClick={() => applyPreset('custom')} className={preset === 'custom' ? btnGreen : btnGlass}>
                Custom
              </button>
            </div>

            <div className="mt-4">
              <Field label="Notes">
                <textarea className={`${inputCls} min-h-[110px]`} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>

            <button onClick={submit} className={saveWide}>
              Submit Follow Up
            </button>
          </div>

          {/* LISTS */}
          <div className="space-y-6">
            <Section title={`Due Now`} count={dueNowList.length}>
              {loading && <Empty text="Loading…" />}
              {!loading && dueNowList.length === 0 && <Empty text="No follow ups." />}
              {!loading &&
                dueNowList.map((r) => (
                  <Card key={r.id} r={r} due={true} onStatus={setStatus} />
                ))}
            </Section>

            <Section title={`Upcoming`} count={upcomingList.length}>
              {loading && <Empty text="Loading…" />}
              {!loading && upcomingList.length === 0 && <Empty text="No follow ups." />}
              {!loading &&
                upcomingList.map((r) => (
                  <Card key={r.id} r={r} due={false} onStatus={setStatus} />
                ))}
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({
  r,
  due,
  onStatus,
}: {
  r: FollowUp
  due: boolean
  onStatus: (id: string, status: FollowUp['status']) => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{r.full_name || '—'}</div>
          <div className="text-xs text-white/60 mt-1">
            {r.phone || '—'} • {r.company || '—'}
          </div>
          <div className="text-xs text-white/60 mt-1">
            {r.coverage ? `$${Number(r.coverage).toLocaleString()}` : '—'} • {r.follow_up_at ? prettyDT(r.follow_up_at) : '—'}
          </div>
          {r.notes ? <div className="text-xs text-white/70 mt-2">{r.notes}</div> : null}
        </div>

        <div className="text-[11px] px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-white/70">
          {due ? 'DUE' : 'UPCOMING'}
        </div>
      </div>

      {due && (
        <div className="mt-3">
          <div className="text-xs text-white/55 mb-2">Due Now</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onStatus(r.id, 'completed')} className={btnGreen}>
              Closed Deal
            </button>
            <button onClick={() => onStatus(r.id, 'upcoming')} className={btnYellow}>
              Follow up
            </button>
            <button onClick={() => onStatus(r.id, 'denied')} className={btnRed}>
              Denied Coverage
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-5 py-4 bg-white/5 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-white/60">{count}</div>
      </div>
      <div className="p-5 space-y-3">{children}</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-sm text-white/60">{text}</div>
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/55">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
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

function isDue(iso: string | null, now: number) {
  if (!iso) return false
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return false
  return t <= now
}

function prettyDT(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function toNum(v: any) {
  const s = String(v || '').replace(/[^0-9.]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function cleanPhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length !== 10) return raw?.trim() || null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass = 'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold'
const btnGreen = 'rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-2 text-sm font-semibold'
const btnYellow = 'rounded-2xl bg-yellow-500 hover:bg-yellow-400 transition px-4 py-2 text-sm font-semibold text-black'
const btnRed = 'rounded-2xl bg-red-600 hover:bg-red-500 transition px-4 py-2 text-sm font-semibold'

const saveWide =
  'mt-5 w-full rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-3 text-sm font-semibold'
