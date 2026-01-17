'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type FollowUp = {
  id: string
  agent_id: string
  full_name: string
  phone: string | null
  client_dob: string | null
  coverage: number | null
  company: string | null
  notes: string | null
  follow_up_at: string
  status: string // open | done | converted
  created_at: string
}

const COMPANIES = [
  'Aetna',
  'Aflac',
  'AIG',
  'American Amicable',
  'Mutual Of Omaha',
  'Royal Neighbors',
  'Transamerica',
] as const

type Preset = '24' | '48' | 'week' | 'custom' | null

export default function FollowUpsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<FollowUp[]>([])
  const [tab, setTab] = useState<'due' | 'upcoming' | 'all' | 'completed'>('due')
  const [toast, setToast] = useState<string | null>(null)

  const chimeRef = useRef<HTMLAudioElement | null>(null)

  // form (minimal fields)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientDob, setClientDob] = useState('')
  const [coverage, setCoverage] = useState('')
  const [company, setCompany] = useState<(typeof COMPANIES)[number] | ''>('')
  const [notes, setNotes] = useState('')
  const [followUpAt, setFollowUpAt] = useState('') // datetime-local
  const [preset, setPreset] = useState<Preset>(null)

  // row follow-up action panel
  const [activeRescheduleId, setActiveRescheduleId] = useState<string | null>(null)
  const [rowPreset, setRowPreset] = useState<Record<string, Preset>>({})
  const [rowFollowAt, setRowFollowAt] = useState<Record<string, string>>({})

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 15000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load(announceDue = false) {
    setLoading(true)

    const userRes = await supabase.auth.getUser()
    const uid = userRes.data.user?.id
    if (!uid) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('follow_ups')
      .select('id, agent_id, full_name, phone, client_dob, coverage, company, notes, follow_up_at, status, created_at')
      .order('follow_up_at', { ascending: true })

    if (!error && data) {
      const list = data as FollowUp[]
      setItems(list)
      if (announceDue) announceNewDue(list, uid)
    }

    setLoading(false)
  }

  function playChime() {
    try {
      if (!chimeRef.current) chimeRef.current = new Audio('/chime.mp3')
      chimeRef.current.currentTime = 0
      chimeRef.current.play().catch(() => {})
    } catch {}
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') return
    await Notification.requestPermission()
  }

  function notify(message: string) {
    try {
      if (!('Notification' in window)) return
      if (Notification.permission !== 'granted') return
      new Notification('Flow Follow Ups', { body: message })
    } catch {}
  }

  function announceNewDue(list: FollowUp[], uid: string) {
    const now = Date.now()
    const dueNow = list.filter((x) => x.status === 'open' && new Date(x.follow_up_at).getTime() <= now)
    if (dueNow.length === 0) return

    const key = `flow_followups_notified_${uid}`
    const raw = localStorage.getItem(key)
    const seen = new Set<string>(raw ? JSON.parse(raw) : [])

    const newlyDue = dueNow.filter((x) => !seen.has(x.id))
    if (newlyDue.length === 0) return

    newlyDue.forEach((x) => seen.add(x.id))
    localStorage.setItem(key, JSON.stringify(Array.from(seen).slice(-200)))

    const first = newlyDue[0]
    const msg = `Call ${first.full_name} back`
    setToast(msg)
    playChime()
    notify(msg)
  }

  const now = Date.now()
  const due = useMemo(
    () => items.filter((x) => x.status === 'open' && new Date(x.follow_up_at).getTime() <= now),
    [items, now]
  )
  const upcoming = useMemo(
    () => items.filter((x) => x.status === 'open' && new Date(x.follow_up_at).getTime() > now),
    [items, now]
  )
  const completed = useMemo(() => items.filter((x) => x.status !== 'open'), [items])

  const view = useMemo(() => {
    if (tab === 'due') return due
    if (tab === 'upcoming') return upcoming
    if (tab === 'completed') return completed
    return items
  }, [tab, due, upcoming, completed, items])

  function setPresetTime(p: Preset) {
    setPreset(p)
    if (p === '24') setFollowUpAt(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)))
    if (p === '48') setFollowUpAt(toDatetimeLocal(new Date(Date.now() + 48 * 60 * 60 * 1000)))
    if (p === 'week') setFollowUpAt(toDatetimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))
    if (p === 'custom') {
      if (!followUpAt) setFollowUpAt(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)))
    }
  }

  function setRowPresetTime(id: string, p: Preset) {
    setRowPreset((s) => ({ ...s, [id]: p }))
    if (p === '24') setRowFollowAt((s) => ({ ...s, [id]: toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)) }))
    if (p === '48') setRowFollowAt((s) => ({ ...s, [id]: toDatetimeLocal(new Date(Date.now() + 48 * 60 * 60 * 1000)) }))
    if (p === 'week') setRowFollowAt((s) => ({ ...s, [id]: toDatetimeLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) }))
    if (p === 'custom') setRowFollowAt((s) => ({ ...s, [id]: s[id] || toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)) }))
  }

  async function submitFollowUp() {
    setSaving(true)

    const userRes = await supabase.auth.getUser()
    const uid = userRes.data.user?.id
    if (!uid) {
      setSaving(false)
      return
    }

    const followAtIso =
      followUpAt && followUpAt.trim().length > 0
        ? new Date(followUpAt).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const payload = {
      agent_id: uid,
      full_name: fullName.trim(),
      phone: cleanPhone(phone) || null,
      client_dob: clientDob || null,
      coverage: coverage ? Number(cleanMoney(coverage)) : null,
      company: company || null,
      notes: notes.trim() || null,
      follow_up_at: followAtIso,
      status: 'open',
    }

    const { error } = await supabase.from('follow_ups').insert(payload)

    if (error) {
      setToast('Could not submit follow up')
      setSaving(false)
      return
    }

    setFullName('')
    setPhone('')
    setClientDob('')
    setCoverage('')
    setCompany('')
    setNotes('')
    setFollowUpAt('')
    setPreset(null)

    setToast('Follow up submitted ✅')
    setSaving(false)
    await load(false)
  }

  async function closeDeal(fu: FollowUp) {
    const qp = new URLSearchParams({
      fu_id: fu.id,
      full_name: fu.full_name || '',
      phone: fu.phone || '',
      client_dob: fu.client_dob || '',
      company: fu.company || '',
      coverage: fu.coverage?.toString() || '',
      notes: fu.notes || '',
    }).toString()

    window.location.href = `/closed-deal?${qp}`
  }

  function toggleReschedule(fu: FollowUp) {
    if (activeRescheduleId === fu.id) {
      setActiveRescheduleId(null)
      return
    }
    setActiveRescheduleId(fu.id)
    setRowPreset((s) => ({ ...s, [fu.id]: '24' }))
    setRowFollowAt((s) => ({ ...s, [fu.id]: toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)) }))
  }

  async function saveReschedule(id: string) {
    const dtLocal = rowFollowAt[id]
    if (!dtLocal) return
    const iso = new Date(dtLocal).toISOString()
    await supabase.from('follow_ups').update({ follow_up_at: iso }).eq('id', id)

    setActiveRescheduleId(null)
    setToast('Follow up updated ✅')
    await load(false)
  }

  async function deniedCoverage(id: string) {
    await supabase.from('follow_ups').update({ status: 'done', notes: 'Denied Coverage' }).eq('id', id)
    setToast('Marked denied ✅')
    await load(false)
  }

  async function deleteFollowUp(id: string) {
    await supabase.from('follow_ups').delete().eq('id', id)
    await load(false)
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnSoft} onClick={() => setToast(null)}>Dismiss</button>
              <button className={btnPrimary} onClick={() => setToast(null)}>OK</button>
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
            <button onClick={enableNotifications} className={btnGlass}>Enable Alerts</button>
            <button onClick={() => load(true)} className={btnGlass}>Refresh</button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <Tab label={`Due Now (${due.length})`} active={tab === 'due'} onClick={() => setTab('due')} />
          <Tab label={`Upcoming (${upcoming.length})`} active={tab === 'upcoming'} onClick={() => setTab('upcoming')} />
          <Tab label={`All (${items.length})`} active={tab === 'all'} onClick={() => setTab('all')} />
          <Tab label={`Completed (${completed.length})`} active={tab === 'completed'} onClick={() => setTab('completed')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* FORM */}
          <div className="lg:col-span-5">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="text-sm font-semibold mb-4">Submit a Follow Up</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="John Doe" />
                </Field>

                <Field label="Phone">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneLive(e.target.value))}
                    className={inputCls}
                    placeholder="(888) 888-8888"
                    inputMode="tel"
                  />
                </Field>

                <Field label="Client DOB">
                  <input value={clientDob} onChange={(e) => setClientDob(e.target.value)} className={inputCls} type="date" />
                </Field>

                <Field label="Company">
                  <select value={company} onChange={(e) => setCompany(e.target.value as any)} className={inputCls}>
                    <option value="">Select…</option>
                    {COMPANIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Coverage">
                  <input
                    value={coverage}
                    onChange={(e) => setCoverage(formatMoneyLive(e.target.value))}
                    className={inputCls}
                    placeholder="10,000.00"
                    inputMode="decimal"
                  />
                </Field>

                <Field label="Follow Up Date/Time">
                  <CalendarInput value={followUpAt} onChange={setFollowUpAt} />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <PresetBtn label="24hrs" active={preset === '24'} onClick={() => setPresetTime('24')} />
                <PresetBtn label="48hrs" active={preset === '48'} onClick={() => setPresetTime('48')} />
                <PresetBtn label="Next Week" active={preset === 'week'} onClick={() => setPresetTime('week')} />
                <PresetBtn label="Custom" active={preset === 'custom'} onClick={() => setPresetTime('custom')} />
              </div>

              <Field label="Notes" className="mt-4">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} min-h-[110px]`} placeholder="Short notes…" />
              </Field>

              <button
                onClick={submitFollowUp}
                disabled={saving || fullName.trim().length === 0}
                className="mt-5 w-full rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit Follow Up'}
              </button>
            </div>
          </div>

          {/* LIST */}
          <div className="lg:col-span-7">
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 text-sm font-semibold">
                {tab === 'due' ? 'Due Now' : tab === 'upcoming' ? 'Upcoming' : tab === 'completed' ? 'Completed' : 'All Follow Ups'}
              </div>

              {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}
              {!loading && view.length === 0 && <div className="px-6 py-10 text-center text-white/60">No follow ups.</div>}

              {!loading &&
                view.map((fu) => {
                  const isDue = fu.status === 'open' && new Date(fu.follow_up_at).getTime() <= Date.now()
                  const rescheduling = activeRescheduleId === fu.id

                  return (
                    <div key={fu.id} className="px-6 py-5 border-t border-white/10 hover:bg-white/5 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold truncate">{fu.full_name}</div>
                            <Pill status={fu.status} due={isDue} />
                          </div>

                          <div className="mt-1 text-xs text-white/60 flex flex-wrap gap-x-4 gap-y-1">
                            <span>{fu.phone ? fu.phone : '—'}</span>
                            <span>{fu.company ? fu.company : '—'}</span>
                            <span>{fu.coverage != null ? `$${money(fu.coverage)}` : '—'}</span>
                            <span>{formatWhen(fu.follow_up_at)}</span>
                          </div>

                          {fu.notes && <div className="mt-3 text-sm text-white/80">{fu.notes}</div>}

                          {/* DUE NOW ACTIONS */}
                          {tab === 'due' && fu.status === 'open' && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <ActionBtn tone="green" active={false} onClick={() => closeDeal(fu)}>
                                Closed Deal
                              </ActionBtn>
                              <ActionBtn tone="yellow" active={rescheduling} onClick={() => toggleReschedule(fu)}>
                                Follow up
                              </ActionBtn>
                              <ActionBtn tone="red" active={false} onClick={() => deniedCoverage(fu.id)}>
                                Denied Coverage
                              </ActionBtn>
                            </div>
                          )}

                          {/* RESCHEDULE PANEL */}
                          {rescheduling && (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="text-xs text-white/60 mb-3">Reschedule follow up</div>

                              <div className="flex flex-wrap gap-2 mb-3">
                                <PresetBtn label="24hrs" active={rowPreset[fu.id] === '24'} onClick={() => setRowPresetTime(fu.id, '24')} />
                                <PresetBtn label="48hrs" active={rowPreset[fu.id] === '48'} onClick={() => setRowPresetTime(fu.id, '48')} />
                                <PresetBtn label="Next Week" active={rowPreset[fu.id] === 'week'} onClick={() => setRowPresetTime(fu.id, 'week')} />
                                <PresetBtn label="Custom" active={rowPreset[fu.id] === 'custom'} onClick={() => setRowPresetTime(fu.id, 'custom')} />
                              </div>

                              <CalendarInput
                                value={rowFollowAt[fu.id] || ''}
                                onChange={(v) => setRowFollowAt((s) => ({ ...s, [fu.id]: v }))}
                              />

                              <div className="mt-3 flex gap-2">
                                <button className={btnSoft} onClick={() => setActiveRescheduleId(null)}>Cancel</button>
                                <button className={btnPrimary} onClick={() => saveReschedule(fu.id)}>Save</button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          <button className={btnDanger} onClick={() => deleteFollowUp(fu.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* UI */

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-2xl px-4 py-2 text-sm border transition',
        active ? 'bg-white/10 border-white/15' : 'bg-transparent border-white/10 hover:bg-white/5',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className || ''}>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function PresetBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl border px-3 py-2 text-xs transition',
        active ? 'border-green-400/30 bg-green-500/15 text-green-100' : 'border-white/10 bg-white/5 hover:bg-white/10',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function ActionBtn({
  children,
  onClick,
  tone,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  tone: 'green' | 'yellow' | 'red'
  active: boolean
}) {
  const base =
    tone === 'green'
      ? 'border-green-400/25 bg-green-500/15 hover:bg-green-500/20 text-green-100'
      : tone === 'yellow'
      ? 'border-yellow-400/25 bg-yellow-500/15 hover:bg-yellow-500/20 text-yellow-100'
      : 'border-red-400/25 bg-red-500/15 hover:bg-red-500/20 text-red-100'

  const activeRing =
    tone === 'yellow' && active ? ' ring-2 ring-yellow-300/30' : ''

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-xs transition ${base}${activeRing}`}
    >
      {children}
    </button>
  )
}

function Pill({ status, due }: { status: string; due: boolean }) {
  const cls =
    status === 'converted'
      ? 'bg-green-500/10 border-green-400/20 text-green-200'
      : status === 'done'
      ? 'bg-white/5 border-white/10 text-white/70'
      : due
      ? 'bg-red-500/10 border-red-400/20 text-red-200'
      : 'bg-yellow-500/10 border-yellow-400/20 text-yellow-200'

  const text = status === 'converted' ? 'Converted' : status === 'done' ? 'Done' : due ? 'Due' : 'Upcoming'
  return <span className={`text-[11px] px-2 py-1 rounded-xl border ${cls}`}>{text}</span>
}

function CalendarInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} type="datetime-local" />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-70">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}

/* styles */

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'flex-1 rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnPrimary = 'flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 transition px-3 py-2 text-xs font-semibold'
const btnDanger = 'rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs hover:bg-red-500/15 transition'

/* formatting */

function cleanPhone(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 10)
  if (d.length < 10) return null
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function formatPhoneLive(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 10)
  const a = d.slice(0, 3)
  const b = d.slice(3, 6)
  const c = d.slice(6, 10)
  if (d.length <= 3) return a ? `(${a}` : ''
  if (d.length <= 6) return `(${a}) ${b}`
  return `(${a}) ${b}-${c}`
}

function cleanMoney(v: string) {
  return (v || '').replace(/[^0-9.]/g, '')
}

function formatMoneyLive(v: string) {
  const raw = cleanMoney(v)
  if (!raw) return ''
  const parts = raw.split('.')
  const intPart = parts[0].replace(/^0+(?=\d)/, '')
  const decPart = parts[1]?.slice(0, 2) || ''
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart.length ? `${withCommas}.${decPart}` : withCommas
}

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString()
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
