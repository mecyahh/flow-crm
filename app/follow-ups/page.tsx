'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Friend', 'Sibling', 'Estate', 'Other'] as const

const CARRIERS = [
  'Aetna',
  'Aflac',
  'AIG',
  'American Amicable',
  'Mutual Of Omaha',
  'Royal Neighbors',
  'Transamerica',
] as const

type FollowUpRow = {
  id: string
  full_name: string
  phone: string | null
  client_dob: string | null
  beneficiary_name: string | null
  beneficiary_dob: string | null
  coverage: number | null
  premium: number | null
  company: string | null
  notes: string | null
  follow_up_at: string
  status: string
  created_at: string
}

type Filter = 'Due Now' | 'Today' | 'Next 7 Days' | 'All' | 'Completed'

export default function FollowUpsPage() {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [items, setItems] = useState<FollowUpRow[]>([])
  const [filter, setFilter] = useState<Filter>('Due Now')

  // form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientDob, setClientDob] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [beneficiaryDob, setBeneficiaryDob] = useState('')
  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [company, setCompany] = useState<(typeof CARRIERS)[number]>('Aetna')
  const [notes, setNotes] = useState('')

  // follow up scheduler
  const [preset, setPreset] = useState<'24hrs' | '48hrs' | 'Next Week' | 'Custom'>('24hrs')
  const [customDate, setCustomDate] = useState<string>('') // YYYY-MM-DD
  const [customTime, setCustomTime] = useState<string>('09:00') // HH:MM

  // notifications
  const [toast, setToast] = useState<string | null>(null)
  const chimeRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        window.location.href = '/login'
        return
      }
      setReady(true)
      await load()
    })()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('follow_ups')
      .select(
        'id,full_name,phone,client_dob,beneficiary_name,beneficiary_dob,coverage,premium,company,notes,follow_up_at,status,created_at'
      )
      .order('follow_up_at', { ascending: true })
      .limit(500)

    if (!error && data) setItems(data as FollowUpRow[])
    setLoading(false)
  }

  const now = useMemo(() => new Date(), [items.length]) // re-evaluate after reload

  const visible = useMemo(() => {
    const n = new Date()
    const startToday = new Date(n.getFullYear(), n.getMonth(), n.getDate())
    const endToday = new Date(startToday)
    endToday.setDate(endToday.getDate() + 1)

    const endWeek = new Date(startToday)
    endWeek.setDate(endWeek.getDate() + 7)

    const base = items.slice()

    if (filter === 'Completed') return base.filter((x) => x.status === 'Completed')
    if (filter === 'All') return base.filter((x) => x.status !== 'Completed')

    if (filter === 'Due Now') {
      return base.filter((x) => x.status !== 'Completed' && new Date(x.follow_up_at) <= n)
    }

    if (filter === 'Today') {
      return base.filter((x) => {
        const dt = new Date(x.follow_up_at)
        return x.status !== 'Completed' && dt >= startToday && dt < endToday
      })
    }

    // Next 7 Days
    return base.filter((x) => {
      const dt = new Date(x.follow_up_at)
      return x.status !== 'Completed' && dt >= startToday && dt < endWeek
    })
  }, [items, filter])

  // reminder loop (every 30s)
  useEffect(() => {
    if (!ready) return
    const id = setInterval(async () => {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('id,full_name,follow_up_at,status')
        .neq('status', 'Completed')
        .order('follow_up_at', { ascending: true })
        .limit(50)

      if (error || !data) return

      const due = (data as any[]).filter((x) => new Date(x.follow_up_at) <= new Date())
      if (!due.length) return

      for (const d of due) {
        const key = `flow_notified_${d.id}`
        if (localStorage.getItem(key)) continue
        localStorage.setItem(key, '1')

        const message = `Call ${d.full_name} back`
        setToast(message)
        playChime()

        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Flow Reminder', { body: message })
          }
        }
      }

      // keep UI fresh
      await load()
    }, 30000)

    return () => clearInterval(id)
  }, [ready])

  function playChime() {
    try {
      if (!chimeRef.current) {
        chimeRef.current = new Audio('/chime.mp3')
      }
      chimeRef.current.currentTime = 0
      chimeRef.current.play().catch(() => {})
    } catch {}
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') return
    await Notification.requestPermission()
  }

  function computedFollowUpAtISO(): string | null {
    const n = new Date()
    if (preset === '24hrs') return new Date(n.getTime() + 24 * 60 * 60 * 1000).toISOString()
    if (preset === '48hrs') return new Date(n.getTime() + 48 * 60 * 60 * 1000).toISOString()
    if (preset === 'Next Week') return new Date(n.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Custom
    if (!customDate) return null
    const [hh, mm] = (customTime || '09:00').split(':').map((x) => Number(x))
    const d = parseISO(customDate)
    d.setHours(isNaN(hh) ? 9 : hh, isNaN(mm) ? 0 : mm, 0, 0)
    return d.toISOString()
  }

  async function submitFollowUp() {
    setMsg(null)

    const followUpAt = computedFollowUpAtISO()
    if (!fullName.trim() || !followUpAt) {
      setMsg('Full name + follow up time required.')
      return
    }

    setSaving(true)

    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) {
      setSaving(false)
      window.location.href = '/login'
      return
    }

    const payload: any = {
      agent_id: user.id,
      full_name: fullName.trim(),
      phone: normalizePhone(phone) || null,
      client_dob: clientDob || null,
      beneficiary_name: beneficiaryName.trim() || null,
      beneficiary_dob: beneficiaryDob || null,
      coverage: toNum(coverage),
      premium: toNum(premium),
      company: String(company || '').trim() || null,
      notes: notes.trim() || null,
      follow_up_at: followUpAt,
      status: 'Pending',
    }

    const { error } = await supabase.from('follow_ups').insert(payload)

    setSaving(false)

    if (error) {
      setMsg(error.message)
      return
    }

    setMsg('Follow up submitted ✅')
    clearForm()
    await load()
  }

  function clearForm() {
    setFullName('')
    setPhone('')
    setClientDob('')
    setBeneficiaryName('')
    setBeneficiaryDob('')
    setCoverage('')
    setPremium('')
    setCompany('Aetna')
    setNotes('')
    setPreset('24hrs')
    setCustomDate('')
    setCustomTime('09:00')
  }

  async function markComplete(id: string) {
    setSaving(true)
    const { error } = await supabase.from('follow_ups').update({ status: 'Completed' }).eq('id', id)
    setSaving(false)
    if (!error) await load()
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] text-white flex items-center justify-center">
        <div className="glass px-6 py-4">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-4 py-3 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="text-xs text-white/60 mt-1">Reminder triggered</div>
            <button
              className="mt-3 w-full rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
              onClick={() => setToast(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Follow Ups</h1>
            <p className="text-sm text-white/60 mt-1">No deals slipping through the cracks.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={enableNotifications}
              className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
              title="Enable browser notifications"
            >
              Enable Alerts
            </button>
            <button
              onClick={() => (window.location.href = '/dashboard')}
              className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Form */}
          <div className="xl:col-span-2 glass p-7">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Submit a Follow Up</h2>
              <span className="text-xs text-white/60">Fast + clean</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name *">
                <Input value={fullName} onChange={setFullName} placeholder="John Doe" />
              </Field>

              <Field label="Phone">
                <Input
                  value={phone}
                  onChange={(v) => setPhone(formatPhoneLive(v))}
                  placeholder="(888)888-8888"
                  inputMode="tel"
                />
              </Field>

              <Field label="Client DOB">
                <FlowDatePicker value={clientDob} onChange={setClientDob} />
              </Field>

              <Field label="Company">
                <Select value={company} onChange={(v) => setCompany(v as any)} options={CARRIERS as any} />
              </Field>

              <Field label="Premium">
                <Input value={premium} onChange={setPremium} onBlurFormat="money" placeholder="100.00" inputMode="decimal" />
              </Field>

              <Field label="Coverage">
                <Input value={coverage} onChange={setCoverage} onBlurFormat="money" placeholder="250,000.00" inputMode="decimal" />
              </Field>

              <Field label="Beneficiary Name">
                <Input value={beneficiaryName} onChange={setBeneficiaryName} placeholder="Jane Doe" />
              </Field>

              <Field label="Beneficiary DOB">
                <FlowDatePicker value={beneficiaryDob} onChange={setBeneficiaryDob} />
              </Field>

              <div className="md:col-span-2">
                <Field label="Notes">
                  <Textarea value={notes} onChange={setNotes} placeholder="Notes…" />
                </Field>
              </div>
            </div>

            {/* Scheduler */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-3">Follow up date</div>

              <div className="flex flex-wrap gap-2 mb-3">
                <PresetBtn active={preset === '24hrs'} onClick={() => setPreset('24hrs')} text="24hrs" />
                <PresetBtn active={preset === '48hrs'} onClick={() => setPreset('48hrs')} text="48hrs" />
                <PresetBtn active={preset === 'Next Week'} onClick={() => setPreset('Next Week')} text="Next Week" />
                <PresetBtn active={preset === 'Custom'} onClick={() => setPreset('Custom')} text="Custom" />
              </div>

              {preset === 'Custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Date">
                    <FlowDatePicker value={customDate} onChange={setCustomDate} />
                  </Field>
                  <Field label="Time">
                    <select
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-blue-500/60"
                    >
                      {timeSlots().map((t) => (
                        <option key={t} value={t} className="bg-[#0b0f1a]">
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}

              <div className="mt-3 text-[11px] text-white/50">
                When it’s due, Flow pops a top-right reminder + chime.
              </div>
            </div>

            {msg && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                {msg}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setMsg(null)
                  clearForm()
                }}
                className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
                disabled={saving}
              >
                Clear
              </button>

              <button
                onClick={submitFollowUp}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition disabled:opacity-60"
              >
                {saving ? 'Submitting…' : 'Submit Follow Up'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="xl:col-span-3 glass p-7">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Your Follow Ups</h2>
              <div className="flex gap-2">
                {(['Due Now', 'Today', 'Next 7 Days', 'All', 'Completed'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-2 rounded-xl text-xs transition ${
                      filter === f ? 'bg-blue-600' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[11px] text-white/60 bg-white/5">
                <div className="col-span-4">Client</div>
                <div className="col-span-3">Company</div>
                <div className="col-span-3">Follow Up</div>
                <div className="col-span-2 text-right">Action</div>
              </div>

              {loading && <div className="px-5 py-10 text-center text-white/60">Loading…</div>}

              {!loading && visible.length === 0 && (
                <div className="px-5 py-10 text-center text-white/60">No follow ups.</div>
              )}

              {!loading &&
                visible.map((x) => {
                  const due = new Date(x.follow_up_at) <= new Date() && x.status !== 'Completed'
                  return (
                    <div key={x.id} className="px-5 py-4 border-t border-white/10 hover:bg-white/5 transition">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <div className="font-medium truncate">{x.full_name}</div>
                          <div className="text-xs text-white/50 truncate">{x.phone || '—'}</div>
                        </div>

                        <div className="col-span-3 text-white/70 truncate">{x.company || '—'}</div>

                        <div className="col-span-3">
                          <div className={`text-sm font-semibold ${due ? 'text-red-300' : 'text-white'}`}>
                            {prettyDateTime(x.follow_up_at)}
                          </div>
                          <div className="text-xs text-white/50">{x.status}</div>
                        </div>

                        <div className="col-span-2 flex justify-end">
                          {x.status !== 'Completed' ? (
                            <button
                              onClick={() => markComplete(x.id)}
                              disabled={saving}
                              className="rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs font-semibold"
                            >
                              Mark Done
                            </button>
                          ) : (
                            <span className="text-xs text-green-400 font-semibold">Done</span>
                          )}
                        </div>
                      </div>

                      {x.notes?.trim() && (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
                          <span className="text-white/50 mr-2">Note:</span>
                          {x.notes}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>

            <div className="mt-4 text-xs text-white/50">
              Tip: enable alerts once per device. Mobile push comes in the mobile app phase.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- UI ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-white/60 mb-2">{label}</div>
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  onBlurFormat,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  onBlurFormat?: 'money'
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => {
        if (onBlurFormat === 'money') onChange(formatMoneyLive(value))
      }}
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-blue-500/60"
    />
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-blue-500/60 resize-none"
    />
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-blue-500/60"
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#0b0f1a]">
          {opt}
        </option>
      ))}
    </select>
  )
}

function PresetBtn({ active, onClick, text }: { active: boolean; onClick: () => void; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
        active ? 'bg-blue-600' : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      {text}
    </button>
  )
}

/* ---------- Calendar (glass) ---------- */

function FlowDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | null>(null)

  const initial = useMemo(() => (value ? parseISO(value) : new Date()), [value])
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      const t = e.target as Node
      if (anchorRef.current && !anchorRef.current.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (!open) return
    const d = value ? parseISO(value) : new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }, [open, value])

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const grid = buildMonthGrid(viewYear, viewMonth)

  return (
    <div className="relative" ref={anchorRef}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none hover:bg-white/7 transition flex items-center justify-between"
      >
        <span className={value ? 'text-white' : 'text-white/50'}>{value ? pretty(value) : 'Select date'}</span>
        <span className="text-white/50">📅</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[320px] rounded-2xl border border-white/10 bg-[#0b0f1a]/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
            <button
              type="button"
              onClick={() => {
                const d = new Date(viewYear, viewMonth, 1)
                d.setMonth(d.getMonth() - 1)
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
              }}
              className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              ‹
            </button>

            <div className="text-sm font-semibold">{monthLabel}</div>

            <button
              type="button"
              onClick={() => {
                const d = new Date(viewYear, viewMonth, 1)
                d.setMonth(d.getMonth() + 1)
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
              }}
              className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              ›
            </button>
          </div>

          <div className="px-4 py-3">
            <div className="grid grid-cols-7 gap-1 text-[11px] text-white/50 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.flat().map((cell, i) => {
                const iso = toISO(cell.date)
                const isSelected = value === iso
                const isThisMonth = cell.inMonth
                const isToday = iso === toISO(new Date())

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange(iso)
                      setOpen(false)
                    }}
                    className={[
                      'h-10 rounded-xl text-sm transition border',
                      isSelected ? 'bg-blue-600 border-blue-500/60 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10',
                      !isThisMonth ? 'text-white/30' : 'text-white',
                      isToday && !isSelected ? 'ring-1 ring-white/15' : '',
                    ].join(' ')}
                  >
                    {cell.date.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange(toISO(new Date()))
                  setOpen(false)
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startDowMon0 = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startDowMon0)

  const grid: { date: Date; inMonth: boolean }[][] = []
  let cur = new Date(start)
  for (let r = 0; r < 6; r++) {
    const row: { date: Date; inMonth: boolean }[] = []
    for (let c = 0; c < 7; c++) {
      row.push({ date: new Date(cur), inMonth: cur.getMonth() === month })
      cur.setDate(cur.getDate() + 1)
    }
    grid.push(row)
  }
  return grid
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split('-').map((x) => Number(x))
  return new Date(y, (m || 1) - 1, d || 1)
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function pretty(iso: string) {
  const d = parseISO(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

/* ---------- helpers ---------- */

function digitsOnly(s: string) {
  return (s || '').replace(/\D/g, '')
}

function formatPhoneLive(input: string) {
  const d = digitsOnly(input).slice(0, 10)
  const a = d.slice(0, 3)
  const b = d.slice(3, 6)
  const c = d.slice(6, 10)
  if (d.length <= 3) return a ? `(${a}` : ''
  if (d.length <= 6) return `(${a})${b}`
  return `(${a})${b}-${c}`
}

function normalizePhone(input: string) {
  const d = digitsOnly(input)
  if (d.length !== 10) return ''
  return `(${d.slice(0, 3)})${d.slice(3, 6)}-${d.slice(6, 10)}`
}

function toNum(v: string) {
  const n = Number((v || '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

function formatMoneyLive(input: string) {
  const n = Number((input || '').replace(/[^0-9.]/g, ''))
  if (!isFinite(n)) return ''
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function prettyDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' })
}

function timeSlots() {
  const out: string[] = []
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      out.push(`${hh}:${mm}`)
    }
  }
  return out
}
