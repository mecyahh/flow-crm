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
  beneficiary_name: string | null
  beneficiary_dob: string | null
  relationship: string | null
  coverage: number | null
  premium: number | null
  company: string | null
  notes: string | null
  follow_up_at: string
  status: 'open' | 'done' | 'converted'
  created_at: string
}

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Estate', 'Other'] as const

const COMPANIES = [
  'Aetna',
  'Aflac',
  'AIG',
  'American Amicable',
  'Mutual Of Omaha',
  'Royal Neighbors',
  'Transamerica',
] as const

export default function FollowUpsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<FollowUp[]>([])
  const [tab, setTab] = useState<'due' | 'upcoming' | 'all' | 'completed'>('due')
  const [toast, setToast] = useState<string | null>(null)

  const chimeRef = useRef<HTMLAudioElement | null>(null)

  // form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientDob, setClientDob] = useState('')
  const [beneficiaryName, setBeneficiaryName] = useState('')
  const [beneficiaryDob, setBeneficiaryDob] = useState('')
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIPS)[number] | ''>('')
  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [company, setCompany] = useState<(typeof COMPANIES)[number] | ''>('')
  const [notes, setNotes] = useState('')
  const [followUpAt, setFollowUpAt] = useState('') // datetime-local string

  // ---------- load + alerts ----------
  useEffect(() => {
    load()

    const id = setInterval(() => {
      load(true)
    }, 15000)

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
      .select('*')
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

    // prevent spamming the same due items
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

  // ---------- computed ----------
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

  // ---------- actions ----------
  async function submitFollowUp() {
    setSaving(true)

    const userRes = await supabase.auth.getUser()
    const uid = userRes.data.user?.id
    if (!uid) {
      setSaving(false)
      return
    }

    // default follow up time if empty
    const followAt =
      followUpAt && followUpAt.trim().length > 0
        ? new Date(followUpAt).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const payload = {
      agent_id: uid,
      full_name: fullName.trim(),
      phone: cleanPhone(phone),
      client_dob: clientDob || null,
      beneficiary_name: beneficiaryName.trim() || null,
      beneficiary_dob: beneficiaryDob || null,
      relationship: relationship || null,
      coverage: coverage ? Number(cleanMoney(coverage)) : null,
      premium: premium ? Number(cleanMoney(premium)) : null,
      company: company || null,
      notes: notes.trim() || null,
      follow_up_at: followAt,
      status: 'open' as const,
    }

    const { error } = await supabase.from('follow_ups').insert(payload)

    if (error) {
      setToast('Could not submit follow up')
      setSaving(false)
      return
    }

    // reset
    setFullName('')
    setPhone('')
    setClientDob('')
    setBeneficiaryName('')
    setBeneficiaryDob('')
    setRelationship('')
    setCoverage('')
    setPremium('')
    setCompany('')
    setNotes('')
    setFollowUpAt('')

    setToast('Follow up submitted ✅')
    setSaving(false)
    await load(false)
  }

  async function markDone(id: string) {
    await supabase.from('follow_ups').update({ status: 'done' }).eq('id', id)
    await load(false)
  }

  async function deleteFollowUp(id: string) {
    await supabase.from('follow_ups').delete().eq('id', id)
    await load(false)
  }

  async function markSold(fu: FollowUp) {
    // Try: insert into deals with common columns.
    // If schema doesn’t match, we redirect to Post a Deal with prefill so nothing is lost.
    const userRes = await supabase.auth.getUser()
    const uid = userRes.data.user?.id
    if (!uid) return

    const dealPayload: any = {
      agent_id: uid,
      full_name: fu.full_name,
      client_name: fu.full_name, // fallback if your deals table uses client_name
      phone: fu.phone,
      dob: fu.client_dob,
      client_dob: fu.client_dob,
      beneficiary: fu.beneficiary_name,
      beneficiary_name: fu.beneficiary_name,
      beneficiary_dob: fu.beneficiary_dob,
      relationship: fu.relationship,
      coverage: fu.coverage,
      premium: fu.premium,
      company: fu.company,
      carrier: fu.company,
      notes: fu.notes,
      note: fu.notes,
    }

    const { error } = await supabase.from('deals').insert(dealPayload)

    if (!error) {
      await supabase.from('follow_ups').update({ status: 'converted' }).eq('id', fu.id)
      setToast('Converted to Deal ✅')
      await load(false)
      return
    }

    // fallback: prefill post-deal
    const qp = new URLSearchParams({
      full_name: fu.full_name || '',
      phone: fu.phone || '',
      client_dob: fu.client_dob || '',
      beneficiary_name: fu.beneficiary_name || '',
      beneficiary_dob: fu.beneficiary_dob || '',
      relationship: fu.relationship || '',
      coverage: fu.coverage?.toString() || '',
      premium: fu.premium?.toString() || '',
      company: fu.company || '',
      notes: fu.notes || '',
    }).toString()

    setToast('Open Post a Deal (prefilled)')
    window.location.href = `/post-deal?${qp}`
  }

  function quickSet(hoursFromNow: number) {
    const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
    setFollowUpAt(toDatetimeLocal(d))
  }

  function nextWeek() {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    setFollowUpAt(toDatetimeLocal(d))
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs"
                onClick={() => setToast(null)}
              >
                Dismiss
              </button>
              <button
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 transition px-3 py-2 text-xs font-semibold"
                onClick={() => setToast(null)}
              >
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
            <p className="text-sm text-white/60 mt-1">Reminders + notifications.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={enableNotifications}
              className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
            >
              Enable Alerts
            </button>
            <button
              onClick={() => load(true)}
              className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs + counts */}
        <div className="mb-6 flex flex-wrap gap-3">
          <Tab label={`Due (${due.length})`} active={tab === 'due'} onClick={() => setTab('due')} />
          <Tab
            label={`Upcoming (${upcoming.length})`}
            active={tab === 'upcoming'}
            onClick={() => setTab('upcoming')}
          />
          <Tab label={`All (${items.length})`} active={tab === 'all'} onClick={() => setTab('all')} />
          <Tab
            label={`Completed (${completed.length})`}
            active={tab === 'completed'}
            onClick={() => setTab('completed')}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: form */}
          <div className="lg:col-span-5">
            <div className="glass rounded-2xl border border-white/10 p-6">
              <div className="text-sm font-semibold mb-4">Submit a Follow Up</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputCls}
                    placeholder="John Doe"
                  />
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
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Beneficiary Name">
                  <input
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    className={inputCls}
                    placeholder="Jane Doe"
                  />
                </Field>

                <Field label="Beneficiary DOB">
                  <input
                    value={beneficiaryDob}
                    onChange={(e) => setBeneficiaryDob(e.target.value)}
                    className={inputCls}
                    type="date"
                  />
                </Field>

                <Field label="Relationship">
                  <select value={relationship} onChange={(e) => setRelationship(e.target.value as any)} className={inputCls}>
                    <option value="">Select…</option>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
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

                <Field label="Premium">
                  <input
                    value={premium}
                    onChange={(e) => setPremium(formatMoneyLive(e.target.value))}
                    className={inputCls}
                    placeholder="100.00"
                    inputMode="decimal"
                  />
                </Field>

                <Field label="Follow Up Date/Time">
                  <input
                    value={followUpAt}
                    onChange={(e) => setFollowUpAt(e.target.value)}
                    className={inputCls}
                    type="datetime-local"
                  />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className={chipCls} onClick={() => quickSet(24)} type="button">
                  24hrs
                </button>
                <button className={chipCls} onClick={() => quickSet(48)} type="button">
                  48hrs
                </button>
                <button className={chipCls} onClick={() => nextWeek()} type="button">
                  Next Week
                </button>
                <button
                  className={chipCls}
                  onClick={() => setFollowUpAt(toDatetimeLocal(new Date()))}
                  type="button"
                >
                  Now
                </button>
              </div>

              <Field label="Notes" className="mt-4">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputCls} min-h-[110px]`}
                  placeholder="Key details, underwriting, next steps…"
                />
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

          {/* RIGHT: list */}
          <div className="lg:col-span-7">
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 bg-white/5 text-sm font-semibold">
                {tab === 'due' ? 'Due Now' : tab === 'upcoming' ? 'Upcoming' : tab === 'completed' ? 'Completed' : 'All Follow Ups'}
              </div>

              {loading && <div className="px-6 py-10 text-center text-white/60">Loading…</div>}

              {!loading && view.length === 0 && (
                <div className="px-6 py-10 text-center text-white/60">No follow ups.</div>
              )}

              {!loading &&
                view.map((fu) => (
                  <div key={fu.id} className="px-6 py-5 border-t border-white/10 hover:bg-white/5 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold truncate">{fu.full_name}</div>
                          <Pill status={fu.status} followAt={fu.follow_up_at} />
                        </div>

                        <div className="mt-1 text-xs text-white/60 flex flex-wrap gap-x-4 gap-y-1">
                          <span>{fu.phone ? fu.phone : '—'}</span>
                          <span>{fu.company ? fu.company : '—'}</span>
                          <span>{fu.premium != null ? `$${money(fu.premium)}` : '—'}</span>
                          <span>{formatWhen(fu.follow_up_at)}</span>
                        </div>

                        {fu.notes && <div className="mt-3 text-sm text-white/80">{fu.notes}</div>}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        {fu.status === 'open' && (
                          <>
                            <button className={btnCls} onClick={() => markSold(fu)}>
                              Mark Sold
                            </button>
                            <button className={btnCls} onClick={() => markDone(fu.id)}>
                              Done
                            </button>
                          </>
                        )}

                        <button className={btnDangerCls} onClick={() => deleteFollowUp(fu.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- UI helpers ---------------- */

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

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className || ''}>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function Pill({ status, followAt }: { status: string; followAt: string }) {
  const now = Date.now()
  const t = new Date(followAt).getTime()
  const due = status === 'open' && t <= now

  const cls =
    status === 'converted'
      ? 'bg-green-500/10 border-green-400/20 text-green-200'
      : status === 'done'
      ? 'bg-white/5 border-white/10 text-white/70'
      : due
      ? 'bg-red-500/10 border-red-400/20 text-red-200'
      : 'bg-yellow-500/10 border-yellow-400/20 text-yellow-200'

  const text =
    status === 'converted' ? 'Converted' : status === 'done' ? 'Done' : due ? 'Due' : 'Upcoming'

  return <span className={`text-[11px] px-2 py-1 rounded-xl border ${cls}`}>{text}</span>
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const chipCls =
  'rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition'

const btnCls =
  'rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition'

const btnDangerCls =
  'rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs hover:bg-red-500/15 transition'

/* ---------------- formatting ---------------- */

function cleanPhone(v: string) {
  const d = (v || '').replace(/\D/g, '').slice(0, 10)
  if (d.length < 10) return v || null
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
  const d = new Date(iso)
  return d.toLocaleString()
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}
