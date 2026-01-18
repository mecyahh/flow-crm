'use client'

export const dynamic = 'force-dynamic'

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
  company: string | null
  coverage: number | null
  notes: string | null
}

type DealPayload = {
  agent_id: string
  follow_up_id: string
  full_name: string | null
  phone: string | null
  dob: string | null
  company: string | null
  policy_number: string | null
  coverage: number | null
  premium: number | null
  status: string
  note: string | null
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

export default function CloseDealPage() {
  const router = useRouter()
  const params = useParams()
  const followUpId = String((params as any)?.followUpId || '')

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [fu, setFu] = useState<FollowUp | null>(null)

  const [full_name, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [company, setCompany] = useState('')
  const [coverage, setCoverage] = useState('')
  const [policy_number, setPolicyNumber] = useState('')
  const [premium, setPremium] = useState('')

  useEffect(() => {
    if (!followUpId) return
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUpId])

  async function boot() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) {
      setToast('Not logged in')
      setLoading(false)
      return
    }

    // Load follow-up
    const { data: fuData, error: fuErr } = await supabase
      .from('follow_ups')
      .select('id, agent_id, full_name, phone, client_dob, company, coverage, notes')
      .eq('id', followUpId)
      .single()

    if (fuErr || !fuData) {
      setToast('Could not load follow up')
      setLoading(false)
      return
    }

    setFu(fuData as FollowUp)

    // Prefill from follow-up
    setFullName(fuData.full_name || '')
    setPhone(fuData.phone || '')
    setDob(fuData.client_dob || '')
    setCompany(fuData.company || '')
    setCoverage(fuData.coverage ? String(fuData.coverage) : '')
    setPremium('') // intentionally blank (close-out data)
    setPolicyNumber('')

    // Ensure a deal exists for this followUpId (no duplicates)
    const { data: existing } = await supabase
      .from('deals')
      .select('id, policy_number, premium, status')
      .eq('follow_up_id', followUpId)
      .maybeSingle()

    if (existing) {
      // If already created, keep their entered values
      if (existing.policy_number) setPolicyNumber(existing.policy_number as any)
      if (existing.premium) setPremium(String(existing.premium))
    } else {
      const payload: DealPayload = {
        agent_id: uid,
        follow_up_id: followUpId,
        full_name: fuData.full_name || null,
        phone: fuData.phone || null,
        dob: fuData.client_dob || null,
        company: fuData.company || null,
        policy_number: null,
        coverage: fuData.coverage ?? null,
        premium: null,
        status: 'pending',
        note: fuData.notes || null,
      }
      await supabase.from('deals').insert(payload)
    }

    setLoading(false)
  }

  async function finalize() {
    if (!fu) return

    const payload = {
      full_name: full_name.trim() || null,
      phone: cleanPhone(phone) || null,
      dob: dob || null,
      company: company.trim() || null,
      policy_number: policy_number.trim() || null,
      coverage: toNum(coverage),
      premium: toNum(premium),
      status: 'pending',
    }

    const { error } = await supabase.from('deals').update(payload).eq('follow_up_id', followUpId)
    if (error) {
      setToast('Save failed')
      return
    }

    // mark follow-up closed_deal
    await supabase.from('follow_ups').update({ outcome: 'closed_deal' }).eq('id', followUpId)

    setToast('Deal moved to Deal House ✅')
    setTimeout(() => router.push('/deal-house'), 400)
  }

  const title = useMemo(() => (fu?.full_name ? `Close Deal • ${fu.full_name}` : 'Close Deal'), [fu?.full_name])

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
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-white/60 mt-1">Prefilled from Follow Ups. Finish the missing fields.</p>
          </div>

          <button onClick={() => router.push('/follow-ups')} className={btnGlass}>
            Back
          </button>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-6">
          {loading ? (
            <div className="px-6 py-10 text-center text-white/60">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input className={inputCls} value={full_name} onChange={(e) => setFullName(e.target.value)} />
                </Field>

                <Field label="Phone">
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(888) 888-8888" />
                </Field>

                <Field label="DOB">
                  <FlowDatePicker value={dob} onChange={setDob} placeholder="Select DOB" />
                </Field>

                <Field label="Company">
                  <select className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)}>
                    <option value="">Select…</option>
                    {CARRIERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Coverage">
                  <input className={inputCls} value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="100000" />
                </Field>

                <Field label="Premium">
                  <input className={inputCls} value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="100" />
                </Field>

                <Field label="Policy #">
                  <input className={inputCls} value={policy_number} onChange={(e) => setPolicyNumber(e.target.value)} />
                </Field>

                <Field label="Status">
                  <input className={inputCls} value="PENDING" disabled />
                </Field>
              </div>

              <button onClick={finalize} className="mt-6 w-full rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-3 text-sm font-semibold">
                Save & Send to Deal House
              </button>
            </>
          )}
        </div>
      </div>
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
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
