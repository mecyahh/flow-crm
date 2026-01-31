'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import GlassSelect from '@/app/components/GlassSelect'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'
import { useRouter } from 'next/navigation'

type FollowUp = {
  id: string
  created_at: string
  agent_id: string
  full_name: string | null
  phone: string | null
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
  const router = useRouter()

  const [toast, setToast] = useState<string | null>(null)
  const [rows, setRows] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ Alerts always ON and cannot be turned off
  const [alertsOn] = useState(true)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    dob: '', // stored in notes
    company: '',
    coverage: '',
    follow_up_date: '', // YYYY-MM-DD
    follow_up_time: '09:00', // HH:MM
    notes: '',
  })

  const [preset, setPreset] = useState<'24' | '48' | 'week' | 'custom' | ''>('')

  const chimeRef = useRef<HTMLAudioElement | null>(null)

  // ✅ Reschedule/edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<FollowUp | null>(null)
  const [editDraft, setEditDraft] = useState({
    full_name: '',
    phone: '',
    dob: '',
    company: '',
    coverage: '',
    follow_up_date: '',
    follow_up_time: '09:00',
    notes: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    chimeRef.current = typeof Audio !== 'undefined' ? new Audio('/chime.mp3') : null

    const now = new Date()
    setForm((f) => ({
      ...f,
      follow_up_date: toISODateLocal(now),
      follow_up_time: '09:00',
    }))

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
      .select('id, created_at, agent_id, full_name, phone, company, coverage, follow_up_at, notes, status')
      .eq('agent_id', uid)
      .order('follow_up_at', { ascending: true })
      .limit(3000)

    if (error) {
      setToast(`Could not load follow ups (RLS): ${error.message}`)
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

  // ✅ Chime immediately when there are due items + every 30 minutes until cleared
  useEffect(() => {
    if (!alertsOn) return
    if (dueNowList.length === 0) return

    let alive = true
    const ring = () => {
      if (!alive) return
      try {
        chimeRef.current?.play().catch(() => {})
      } catch {}
    }

    ring()
    const id = window.setInterval(ring, 30 * 60 * 1000)

    return () => {
      alive = false
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsOn, dueNowList.length])

  function applyPreset(p: '24' | '48' | 'week' | 'custom') {
    setPreset(p)
    if (p === 'custom') return

    const base = new Date()
    if (p === '24') base.setHours(base.getHours() + 24)
    if (p === '48') base.setHours(base.getHours() + 48)
    if (p === 'week') base.setDate(base.getDate() + 7)

    setForm((f) => ({
      ...f,
      follow_up_date: toISODateLocal(base),
      follow_up_time: toTimeHHMM(base),
    }))
  }

  async function submit() {
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) return setToast('Not logged in')

    if (!form.follow_up_date) return setToast('Follow up date is required')

    const followUpISO = combineLocalDateTimeISO(form.follow_up_date, form.follow_up_time || '09:00')

    const packedNotes = buildNotes({
      dob: form.dob || '',
      notes: form.notes || '',
    })

    const payload = {
      agent_id: uid,
      full_name: form.full_name.trim() || null,
      phone: cleanPhone(form.phone),
      company: form.company || null,
      coverage: toNum(form.coverage),
      follow_up_at: followUpISO,
      notes: packedNotes || null,
      status: 'upcoming',
    }

    const { error } = await supabase.from('follow_ups').insert(payload)
    if (error) return setToast(`Submit failed: ${error.message}`)

    setToast('Follow up submitted ✅')
    setForm({
      full_name: '',
      phone: '',
      dob: '',
      company: '',
      coverage: '',
      follow_up_date: '',
      follow_up_time: '09:00',
      notes: '',
    })
    setPreset('')
    load()
  }

  async function setStatus(id: string, status: FollowUp['status']) {
    const { error } = await supabase.from('follow_ups').update({ status }).eq('id', id)
    if (error) return setToast(`Update failed: ${error.message}`)
    load()
  }

  // ✅ No dual-entry routing actions
  async function routeClosedDeal(r: FollowUp) {
    try {
      await supabase.from('follow_ups').delete().eq('id', r.id)
    } catch {}

    const parsed = parsePackedNotes(r.notes || '')
    const dob = parsed.dob || ''

    const qs = new URLSearchParams()
    if (r.full_name) qs.set('full_name', r.full_name)
    if (r.phone) qs.set('phone', r.phone)
    if (r.company) qs.set('company', r.company)
    if (r.coverage != null) qs.set('coverage', String(r.coverage))
    if (dob) qs.set('dob', dob)

    router.push(`/post-deal?${qs.toString()}`)
  }

  async function denyAndRemove(r: FollowUp) {
    try {
      await supabase.from('follow_ups').update({ status: 'denied' }).eq('id', r.id)
    } catch {}
    try {
      await supabase.from('follow_ups').delete().eq('id', r.id)
    } catch {}

    setToast('Removed ✅')
    load()
  }

  function openEdit(r: FollowUp) {
    const parsed = parsePackedNotes(r.notes || '')
    const dob = parsed.dob || ''

    let d = ''
    let t = '09:00'
    if (r.follow_up_at) {
      const dt = new Date(r.follow_up_at)
      if (!Number.isNaN(dt.getTime())) {
        d = toISODateLocal(dt)
        t = toTimeHHMM(dt)
      }
    }

    setEditRow(r)
    setEditDraft({
      full_name: r.full_name || '',
      phone: r.phone || '',
      dob,
      company: r.company || '',
      coverage: r.coverage != null ? formatMoneyInputNoDollar(String(r.coverage)) : '',
      follow_up_date: d || toISODateLocal(new Date()),
      follow_up_time: t,
      notes: parsed.notes || '',
    })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editRow) return
    if (editSaving) return
    setEditSaving(true)
    try {
      if (!editDraft.follow_up_date) {
        setToast('Follow up date is required')
        return
      }

      const followUpISO = combineLocalDateTimeISO(editDraft.follow_up_date, editDraft.follow_up_time || '09:00')

      const packedNotes = buildNotes({
        dob: editDraft.dob || '',
        notes: editDraft.notes || '',
      })

      const payload: any = {
        full_name: editDraft.full_name.trim() || null,
        phone: cleanPhone(editDraft.phone),
        company: editDraft.company || null,
        coverage: toNum(editDraft.coverage),
        follow_up_at: followUpISO,
        notes: packedNotes || null,
        status: 'upcoming',
      }

      const { error } = await supabase.from('follow_ups').update(payload).eq('id', editRow.id)
      if (error) {
        setToast(`Update failed: ${error.message}`)
        return
      }

      setEditOpen(false)
      setEditRow(null)
      setToast('Updated ✅')
      load()
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      
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

      {editOpen && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 p-6">
          <div className="glass w-full max-w-3xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Edit Follow Up</div>
                <div className="text-xs text-white/55 mt-1">Update details + reschedule without dual entry.</div>
              </div>
              <button
                onClick={() => {
                  setEditOpen(false)
                  setEditRow(null)
                }}
                className={btnGlass}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={inputCls} value={editDraft.full_name} onChange={(e) => setEditDraft((d) => ({ ...d, full_name: e.target.value }))} />
              </Field>

              <Field label="Phone">
                <input
                  className={inputCls}
                  value={editDraft.phone}
                  onChange={(e) => setEditDraft((d) => ({ ...d, phone: formatPhone(e.target.value) }))}
                  placeholder="(888) 888-8888"
                  inputMode="tel"
                />
              </Field>

              <Field label="Client DOB">
                <FlowDatePicker value={editDraft.dob} onChange={(v) => setEditDraft((d) => ({ ...d, dob: v }))} placeholder="Select DOB" />
              </Field>

             <Field label="Company">
  <GlassSelect
    value={form.company}
    onChange={(v) => setForm((f) => ({ ...f, company: v }))}
    placeholder="Select…"
    options={CARRIERS.map((c) => ({ value: c, label: c }))}
  />
</Field>

              <Field label="Coverage">
                <input
                  className={inputCls}
                  value={editDraft.coverage}
                  onChange={(e) => setEditDraft((d) => ({ ...d, coverage: moneyInputLocked(e.target.value) }))}
                  onBlur={() => setEditDraft((d) => ({ ...d, coverage: formatMoneyInputNoDollar(d.coverage) }))}
                  placeholder="100,000.00"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Follow Up Date">
                <FlowDatePicker value={editDraft.follow_up_date} onChange={(v) => setEditDraft((d) => ({ ...d, follow_up_date: v }))} placeholder="Select date" />
              </Field>

              <Field label="Follow Up Time">
                <FlowTimePicker value={editDraft.follow_up_time} onChange={(v) => setEditDraft((d) => ({ ...d, follow_up_time: v }))} />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Notes">
                <textarea className={`${inputCls} min-h-[110px]`} value={editDraft.notes} onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))} />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setEditOpen(false)
                  setEditRow(null)
                }}
                className={btnGlass}
              >
                Cancel
              </button>
              <button onClick={saveEdit} disabled={editSaving} className={[btnGreen, editSaving ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}>
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full min-w-0 px-4 py-6 md:px-10 md:py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Follow Ups</h1>
            <p className="text-sm text-white/60 mt-1">Fast. Simple. No deals slipping.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-green-400/25 bg-green-500/12 px-4 py-2 text-sm font-semibold text-green-200">Alerts ON</div>

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
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm font-semibold mb-4">Submit a Follow Up</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={inputCls} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </Field>

              <Field label="Phone">
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
                  placeholder="(888) 888-8888"
                  inputMode="tel"
                />
              </Field>

              <Field label="Client DOB">
                <FlowDatePicker value={form.dob} onChange={(v) => setForm((f) => ({ ...f, dob: v }))} placeholder="Select DOB" />
              </Field>

              <Field label="Company">
  <GlassSelect
    value={editDraft.company}
    onChange={(v) => setEditDraft((d) => ({ ...d, company: v }))}
    placeholder="Select…"
    options={CARRIERS.map((c) => ({ value: c, label: c }))}
  />
</Field>

              <Field label="Coverage">
                <input
                  className={inputCls}
                  value={form.coverage}
                  onChange={(e) => setForm((f) => ({ ...f, coverage: moneyInputLocked(e.target.value) }))}
                  onBlur={() => setForm((f) => ({ ...f, coverage: formatMoneyInputNoDollar(f.coverage) }))}
                  placeholder="100,000.00"
                  inputMode="decimal"
                />
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
                <FlowTimePicker
                  value={form.follow_up_time}
                  onChange={(v) => {
                    setPreset('custom')
                    setForm((f) => ({ ...f, follow_up_time: v }))
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

          <div className="space-y-6">
            <Section title="Due Now" count={dueNowList.length}>
              {loading && <Empty text="Loading…" />}
              {!loading && dueNowList.length === 0 && <Empty text="No follow ups." />}
              {!loading &&
                dueNowList.map((r) => (
                  <Card
                    key={r.id}
                    r={r}
                    due={true}
                    onStatus={setStatus}
                    onEdit={() => openEdit(r)}
                    onClosedDeal={() => routeClosedDeal(r)}
                    onDenied={() => denyAndRemove(r)}
                    onFollowUp={() => openEdit(r)}
                  />
                ))}
            </Section>

            <Section title="Upcoming" count={upcomingList.length}>
              {loading && <Empty text="Loading…" />}
              {!loading && upcomingList.length === 0 && <Empty text="No follow ups." />}
              {!loading &&
                upcomingList.map((r) => (
                  <Card
                    key={r.id}
                    r={r}
                    due={false}
                    onStatus={setStatus}
                    onEdit={() => openEdit(r)}
                    onClosedDeal={() => routeClosedDeal(r)}
                    onDenied={() => denyAndRemove(r)}
                    onFollowUp={() => openEdit(r)}
                  />
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
  onEdit,
  onFollowUp,
  onClosedDeal,
  onDenied,
}: {
  r: FollowUp
  due: boolean
  onStatus: (id: string, status: FollowUp['status']) => void
  onEdit: () => void
  onFollowUp: () => void
  onClosedDeal: () => void
  onDenied: () => void
}) {
  const parsed = parsePackedNotes(r.notes || '')
  const dob = parsed.dob || ''

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{r.full_name || '—'}</div>
          <div className="text-xs text-white/60 mt-1">
            {r.phone || '—'} • {r.company || '—'}
          </div>
          <div className="text-xs text-white/60 mt-1">
            {r.coverage != null
              ? `$${Number(r.coverage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
            {' • '}
            {r.follow_up_at ? prettyDT(r.follow_up_at) : '—'}
          </div>

          {dob ? <div className="text-xs text-white/60 mt-1">DOB: {prettyDateOnly(dob)}</div> : null}
          {parsed.notes ? <div className="text-xs text-white/70 mt-2">{parsed.notes}</div> : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onEdit} className={iconBtn} title="Edit">
            <PencilIcon />
          </button>

          <div className="text-[11px] px-2 py-1 rounded-xl border border-white/10 bg-white/5 text-white/70">
            {due ? 'DUE' : 'UPCOMING'}
          </div>
        </div>
      </div>

      {due && (
        <div className="mt-3">
          <div className="text-xs text-white/55 mb-2">Due Now</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onClosedDeal} className={btnGreen}>
              Closed Deal
            </button>

            <button onClick={onFollowUp} className={btnYellow}>
              Follow up
            </button>

            <button onClick={onDenied} className={btnRed}>
              Denied Coverage
            </button>

            <button onClick={() => onStatus(r.id, 'completed')} className={btnGlass}>
              Mark Completed
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

function prettyDateOnly(isoDate: string) {
  const d = parseISODate(isoDate)
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
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

function formatPhone(input: string) {
  const digits = (input || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function toISODateLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toTimeHHMM(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function combineLocalDateTimeISO(date: string, time: string) {
  const [y, m, d] = date.split('-').map((x) => Number(x))
  const [hh, mm] = time.split(':').map((x) => Number(x))
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
  return dt.toISOString()
}

function buildNotes({ dob, notes }: { dob: string; notes: string }) {
  const parts: string[] = []
  if (dob) parts.push(`dob: ${dob}`)
  if (notes.trim()) parts.push(`notes: ${notes.trim()}`)
  return parts.join('\n')
}

function parsePackedNotes(raw: string) {
  const out: { dob?: string; notes?: string } = {}
  const lines = String(raw || '').split('\n')
  for (const line of lines) {
    const mDob = line.match(/^dob:\s*(.+)$/i)
    if (mDob) out.dob = mDob[1].trim()
    const mNotes = line.match(/^notes:\s*(.+)$/i)
    if (mNotes) out.notes = mNotes[1].trim()
  }
  if (!out.notes && raw && !out.dob) out.notes = raw.trim()
  return out
}

function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map((x) => Number(x))
  return new Date(y, (m || 1) - 1, d || 1)
}

function moneyInputLocked(v: string) {
  const raw = String(v || '').replace(/,/g, '')
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  const a = parts[0] || ''
  const b = (parts[1] || '').slice(0, 2)
  return parts.length > 1 ? `${a}.${b}` : a
}

function formatMoneyInputNoDollar(v: string) {
  const n = Number(String(v || '').replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n)) return ''
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function FlowTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)

  const hh = useMemo(() => {
    const [h] = (value || '09:00').split(':')
    const n = Number(h)
    return Number.isFinite(n) ? n : 9
  }, [value])

  const mm = useMemo(() => {
    const [, m] = (value || '09:00').split(':')
    const n = Number(m)
    return Number.isFinite(n) ? n : 0
  }, [value])

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), [])

  function set(h: number, m: number) {
    const next = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    onChange(next)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none hover:bg-white/7 transition flex items-center justify-between"
      >
        <span className={value ? 'text-white' : 'text-white/50'}>{value || 'Select time'}</span>
        <span className="text-white/50">🕒</span>
      </button>

      {open && (
        <div className="absolute z-[240] mt-2 w-full rounded-2xl border border-white/10 bg-[#0b0f1a]/95 backdrop-blur-xl shadow-2xl p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-white/55 mb-2">Hour</div>
              <div className="grid grid-cols-6 gap-1">
                {hours.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => set(h, mm)}
                    className={[
                      'h-9 rounded-xl text-xs transition border',
                      h === hh ? 'bg-blue-600 border-blue-500/60 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10',
                    ].join(' ')}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-white/55 mb-2">Minute</div>
              <div className="grid grid-cols-3 gap-1">
                {minutes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set(hh, m)}
                    className={[
                      'h-9 rounded-xl text-xs transition border',
                      m === mm ? 'bg-blue-600 border-blue-500/60 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10',
                    ].join(' ')}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const n = new Date()
                    set(n.getHours(), n.getMinutes())
                    setOpen(false)
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs"
                >
                  Now
                </button>
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs">
                  Done
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-white/45">Glass time picker (Flow style).</div>
        </div>
      )}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="rgba(255,255,255,0.70)" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
        stroke="rgba(255,255,255,0.70)"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
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

const iconBtn =
  'rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-2.5 py-2 text-xs inline-flex items-center justify-center'
