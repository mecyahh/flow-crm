'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function PostDealPage() {
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [policyNumber, setPolicyNumber] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [beneficiary, setBeneficiary] = useState('')
  const [beneficiaryRelationship, setBeneficiaryRelationship] =
    useState<(typeof RELATIONSHIPS)[number]>('Spouse')
  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [company, setCompany] = useState<(typeof CARRIERS)[number]>('Aetna')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        window.location.href = '/login'
        return
      }
      setReady(true)
    })()
  }, [])

  const premiumNumber = useMemo(() => parseMoneyToNumber(premium), [premium])
  const coverageNumber = useMemo(() => parseMoneyToNumber(coverage), [coverage])

  async function submitDeal() {
    setMsg(null)

    if (!fullName.trim() || !String(company).trim() || premiumNumber <= 0) {
      setMsg('Full name, company, and premium are required.')
      return
    }

    setLoading(true)

    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) {
      setLoading(false)
      window.location.href = '/login'
      return
    }

    const payload: any = {
      user_id: user.id,
      policy_number: policyNumber.trim() || null,
      full_name: fullName.trim(),
      phone: normalizePhone(phone) || null,
      client_dob: dob || null,
      beneficiary: beneficiary.trim() || null,
      beneficiary_relationship: beneficiaryRelationship,
      coverage: coverageNumber > 0 ? coverageNumber : null,
      premium: premiumNumber,
      company: String(company).trim(),
      notes: notes.trim() || null,
      status: 'Submitted',
    }

    const { error } = await supabase.from('deals').insert(payload)

    setLoading(false)

    if (error) {
      setMsg(error.message)
      return
    }

    setMsg('Deal submitted ✅')
    clearForm()
  }

  function clearForm() {
    setPolicyNumber('')
    setFullName('')
    setPhone('')
    setDob('')
    setBeneficiary('')
    setBeneficiaryRelationship('Spouse')
    setCoverage('')
    setPremium('')
    setCompany('Aetna')
    setNotes('')
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

      <div className="ml-64 px-10 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Post a Deal</h1>
            <p className="text-sm text-white/60 mt-1">
              Clean submission. No duplicates. Everything flows.
            </p>
          </div>

          <button
            onClick={() => (window.location.href = '/dashboard')}
            className="glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="glass p-7 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Policy Number">
              <Input value={policyNumber} onChange={setPolicyNumber} placeholder="Policy #" />
            </Field>

            <Field label="Company *">
              <Select
                value={company}
                onChange={(v) => setCompany(v as any)}
                options={CARRIERS as any}
              />
            </Field>

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
              <Input type="date" value={dob} onChange={setDob} />
            </Field>

            <Field label="Premium (monthly) *">
              <Input
                value={premium}
                onChange={setPremium}
                onBlurFormat="money"
                placeholder="1,000.00"
                inputMode="decimal"
              />
            </Field>

            <Field label="Coverage">
              <Input
                value={coverage}
                onChange={setCoverage}
                onBlurFormat="money"
                placeholder="250,000.00"
                inputMode="decimal"
              />
            </Field>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Beneficiary">
                <Input value={beneficiary} onChange={setBeneficiary} placeholder="Jane Doe" />
              </Field>

              <Field label="Relationship">
                <Select
                  value={beneficiaryRelationship}
                  onChange={(v) => setBeneficiaryRelationship(v as any)}
                  options={RELATIONSHIPS as any}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Notes">
                <Textarea value={notes} onChange={setNotes} placeholder="Anything important…" />
              </Field>
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
              disabled={loading}
            >
              Clear
            </button>

            <button
              onClick={submitDeal}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition disabled:opacity-60"
            >
              {loading ? 'Submitting…' : 'Submit Deal'}
            </button>
          </div>

          <div className="mt-4 text-xs text-white/40">
            Phone auto-formats. Premium/Coverage auto-format on blur.
          </div>
        </div>
      </div>
    </div>
  )
}

/* UI bits */

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
        if (onBlurFormat === 'money') {
          onChange(formatMoneyLive(value))
        }
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

/* formatting helpers */

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

function parseMoneyToNumber(input: string) {
  const cleaned = (input || '').replace(/[^0-9.]/g, '')
  const n = Number(cleaned)
  return isNaN(n) ? 0 : n
}

function formatMoneyLive(input: string) {
  const n = parseMoneyToNumber(input)
  if (!isFinite(n)) return ''
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
