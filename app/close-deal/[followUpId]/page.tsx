'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type FollowUp = {
  id: string
  agent_id: string
  full_name: string | null
  phone: string | null
  client_dob: string | null
  coverage: number | null
  company: string | null
  notes: string | null
}

type DealDraft = {
  full_name: string
  phone: string
  dob: string
  company: string
  policy_number: string
  coverage: string
  premium: string
  status: string
  effective_date: string
  note: string
}

const STATUS = [
  { v: 'pending', label: 'Pending' },
  { v: 'active', label: 'Active' },
  { v: 'chargeback', label: 'Chargeback' },
] as const

export default function CloseDealPage() {
  const router = useRouter()
  const params = useParams<{ followUpId: string }>()
  const followUpId = params.followUpId

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [fu, setFu] = useState<FollowUp | null>(null)
  const [draft, setDraft] = useState<DealDraft>({
    full_name: '',
    phone: '',
    dob: '',
    company: '',
    policy_number: '',
    coverage: '',
    premium: '',
    status: 'pending',
    effective_date: '',
    note: '',
  })

  useEffect(() => {
    hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUpId])

  async function hydrate() {
    setLoading(true)

    const { data: fuData, error: fuErr } = await supabase
      .from('follow_ups')
      .select('id, agent_id, full_name, phone, client_dob, coverage, company, notes')
      .eq('id', followUpId)
      .single()

    if (fuErr || !fuData) {
      setToast('Could not load follow up')
      setLoading(false)
      return
    }

    setFu(fuData as FollowUp)

    setDraft((p) => ({
      ...p,
      full_name: fuData.full_name || '',
      phone: fuData.phone || '',
      dob: fuData.client_dob || '',
      company: fuData.company || '',
      coverage: fuData.coverage ? String(fuData.coverage) : '',
      note: fuData.notes || '',
      status: 'pending',
    }))

    setLoading(false)
  }

  function set<K extends keyof DealDraft>(k: K, v: DealDraft[K]) {
    setDraft((p) => ({ ...p, [k]: v }))
  }

  async function submitDeal() {
    if (!fu) return

    const userRes = await supabase.auth.getUser()
    const uid = userRes.data.user?.id
    if (!uid) return

    // create deal (upsert by follow_up_id)
    const payload: any = {
      follow_up_id: fu.id,
      agent_id: uid,
      full_name: draft.full_name.trim() || null,
      phone: cleanPhone(draft.phone),
      dob: draft.dob || null,
      company: draft.company.trim() || null,
      policy_number: draft.policy_number.trim() || null,
      coverage: toNum(draft.coverage),
      premium: toNum(draft.premium),
      status: (draft.status || 'pending').toLowerCase(),
      effective_date: draft.effective_date || null,
      note: draft.note.trim() || null,
      notes: draft.note.trim() || null,
    }

    const { error } = await supabase
      .from('deals')
      .upsert(payload, { onConflict: 'follow_up_id' })

    if (error) {
      setToast('Could not create deal')
      return
    }

    // mark follow up closed_deal
    await supabase.from('follow_ups').update({ outcome: 'closed_deal' }).eq('id', fu.id)

    setToast('Deal saved ✅')
    setTimeout(() => router.push('/deal-house'), 600)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-[var(--border)] shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className="rounded-xl bg-[var(--panel2)] hover:bg-white/15 transition px-3 py-2 text-xs" onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Close Deal</h1>
            <p className="text-sm text-[var(--text)]/60 mt-1">Prefilled from Follow Ups. Add missing fields only.</p>
          </div>

          <button
            onClick={() => router.push('/follow-ups')}
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-4 py-2 text-sm font-semibold"
          >
            Back
          </button>
        </div>

        {loading && <div className="text-[var(--text)]/60">Loading…</div>}

        {!loading && (
          <div className="glass rounded-2xl border border-[var(--border)] p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input className={inputCls} value={draft.full_name} onChange={(e) => set('full_name', e.target.value)} />
              </Field>

              <Field label="Phone">
                <input className={inputCls} value={draft.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(888) 888-8888" />
              </Field>

              <Field label="DOB">
                <FlowDatePicker value={draft.dob} onChange={(v) => set('dob', v)} placeholder="Select DOB" />
              </Field>

              <Field label="Company">
                <input className={inputCls} value={draft.company} onChange={(e) => set('company', e.target.value)} />
              </Field>

              <Field label="Policy #">
                <input className={inputCls} value={draft.policy_number} onChange={(e) => set('policy_number', e.target.value)} />
              </Field>

              <Field label="Status">
                <select className={inputCls} value={draft.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Coverage">
                <input className={inputCls} value={draft.coverage} onChange={(e) => set('coverage', e.target.value)} placeholder="100000" />
              </Field>

              <Field label="Premium">
                <input className={inputCls} value={draft.premium} onChange={(e) => set('premium', e.target.value)} placeholder="100" />
              </Field>

              <Field label="Effective Date">
                <FlowDatePicker value={draft.effective_date} onChange={(v) => set('effective_date', v)} placeholder="Select effective date" />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Notes">
                <textarea className={`${inputCls} min-h-[110px]`} value={draft.note} onChange={(e) => set('note', e.target.value)} />
              </Field>
            </div>

            <button onClick={submitDeal} className="mt-5 w-full rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-3 text-sm font-semibold">
              Save Deal → Deal House
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--text)]/55 mb-2">{label}</div>
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

const inputCls =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
