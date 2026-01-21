'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

const COMPANIES = [
  'Aetna',
  'Aflac',
  'AIG',
  'American Amicable',
  'Mutual Of Omaha',
  'Royal Neighbors',
  'Transamerica',
] as const

export default function ClosedDealPage() {
  const params = useMemo(
    () => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''),
    []
  )
  const fuId = params.get('fu_id') || ''

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // prefilled
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [clientDob, setClientDob] = useState('')
  const [company, setCompany] = useState<string>('')
  const [coverage, setCoverage] = useState('')
  const [notes, setNotes] = useState('')

  // remaining (finish here)
  const [policyNumber, setPolicyNumber] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [premium, setPremium] = useState('')

  useEffect(() => {
    setFullName(params.get('full_name') || '')
    setPhone(params.get('phone') || '')
    setClientDob(params.get('client_dob') || '')
    setCompany(params.get('company') || '')
    setCoverage(params.get('coverage') || '')
    setNotes(params.get('notes') || '')
  }, [params])

  async function submitClosedDeal() {
    setSaving(true)

    const userRes = await supabase.auth.getUser()
    const uid = userRes.data.user?.id
    if (!uid) {
      setSaving(false)
      return
    }

    const dealPayload: any = {
      agent_id: uid,
      full_name: fullName.trim(),
      client_name: fullName.trim(),
      phone: phone || null,
      dob: clientDob || null,
      client_dob: clientDob || null,
      company: company || null,
      carrier: company || null,
      coverage: coverage ? Number(cleanMoney(coverage)) : null,
      premium: premium ? Number(cleanMoney(premium)) : null,
      notes: notes.trim() || null,
      note: notes.trim() || null,
      policy_number: policyNumber.trim() || null,
      effective_date: effectiveDate || null,
    }

    const { error } = await supabase.from('deals').insert(dealPayload)
    if (error) {
      setToast('Could not submit closed deal')
      setSaving(false)
      return
    }

    if (fuId) await supabase.from('follow_ups').update({ status: 'converted' }).eq('id', fuId)

    setToast('Closed deal submitted ✅')
    setSaving(false)
    window.location.href = '/deal-house'
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-[var(--border)] shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnSoft} onClick={() => setToast(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Closed Deal</h1>
          <p className="text-sm text-[var(--text)]/60 mt-1">Finish remaining details. Prefilled. No lost data.</p>
        </div>

        <div className="glass rounded-2xl border border-[var(--border)] p-6 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="(888) 888-8888" />
            </Field>

            <Field label="Client DOB">
              <input value={clientDob} onChange={(e) => setClientDob(e.target.value)} className={inputCls} type="date" />
            </Field>

            <Field label="Company">
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {COMPANIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="Coverage">
              <input value={coverage} onChange={(e) => setCoverage(formatMoneyLive(e.target.value))} className={inputCls} placeholder="10,000.00" />
            </Field>

            <Field label="Effective Date">
              <input value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputCls} type="date" />
            </Field>

            <Field label="Policy Number">
              <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} className={inputCls} placeholder="Policy #" />
            </Field>

            <Field label="Premium">
              <input value={premium} onChange={(e) => setPremium(formatMoneyLive(e.target.value))} className={inputCls} placeholder="100.00" />
            </Field>
          </div>

          <Field label="Notes" className="mt-4">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} min-h-[120px]`} />
          </Field>

          <button
            onClick={submitClosedDeal}
            disabled={saving || fullName.trim().length === 0}
            className="mt-5 w-full rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Submitting…' : 'Submit Closed Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className || ''}>
      <div className="text-[11px] text-[var(--text)]/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnSoft = 'flex-1 rounded-xl bg-[var(--panel2)] hover:bg-white/15 transition px-3 py-2 text-xs'

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
