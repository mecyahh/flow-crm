'use client'

import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Friend', 'Sibling', 'Other'] as const

export default function PostDealPage() {
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [beneficiary, setBeneficiary] = useState('')
  const [beneficiaryRelationship, setBeneficiaryRelationship] = useState<(typeof RELATIONSHIPS)[number]>('Spouse')
  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [company, setCompany] = useState('')
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

  async function submitDeal() {
    setMsg(null)

    if (!fullName.trim() || !premium.trim() || !company.trim()) {
      setMsg('Full name, premium, and company are required.')
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

    const premiumNum = Number(premium.replace(/[^0-9.]/g, ''))
    const coverageNum = Number(coverage.replace(/[^0-9.]/g, ''))

    const payload: any = {
      user_id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      client_dob: dob || null,
      beneficiary: beneficiary.trim() || null,
      beneficiary_relationship: beneficiaryRelationship,
      coverage: isNaN(coverageNum) ? null : coverageNum,
      premium: isNaN(premiumNum) ? 0 : premiumNum,
      company: company.trim(),
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
    setFullName('')
    setPhone('')
    setDob('')
    setBeneficiary('')
    setBeneficiaryRelationship('Spouse')
    setCoverage('')
    setPremium('')
    setCompany('')
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

        {/* Glass modal */}
        <div className="glass p-7 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name *">
              <Input value={fullName} onChange={setFullName} placeholder="John Doe" />
            </Field>

            <Field label="Phone">
              <Input value={phone} onChange={setPhone} placeholder="(555) 555-5555" />
            </Field>

            <Field label="Client DOB">
              <Input type="date" value={dob} onChange={setDob} />
            </Field>

            <Field label="Company *">
              <Input value={company} onChange={setCompany} placeholder="AIG / Mutual / Foresters" />
            </Field>

            <Field label="Premium (monthly) *">
              <Input value={premium} onChange={setPremium} placeholder="100" />
            </Field>

            <Field label="Coverage">
              <Input value={coverage} onChange={setCoverage} placeholder="250000" />
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
                setFullName('')
                setPhone('')
                setDob('')
                setBeneficiary('')
                setBeneficiaryRelationship('Spouse')
                setCoverage('')
                setPremium('')
                setCompany('')
                setNotes('')
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
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
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
