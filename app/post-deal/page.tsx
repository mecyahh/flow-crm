// ✅ /app/post-deal/page.tsx (REPLACE ENTIRE FILE)
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type CarrierRow = {
  id: string
  name: string
  supported_name: string | null
  advance_rate: number | null
}

type ProductRow = {
  id: string
  carrier_id: string
  product_name: string
  sort_order: number | null
  is_active: boolean | null
}

const RELATIONSHIP = [
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Other',
  'Estate', // ✅ added
] as const

export default function PostDealPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])

  // form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [carrierId, setCarrierId] = useState('')
  const [productName, setProductName] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIP)[number]>('Other')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)

    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      router.push('/login')
      return
    }

    // load carriers
    const { data: cData, error: cErr } = await supabase
      .from('carriers')
      .select('id,name,supported_name,advance_rate')
      .order('name', { ascending: true })

    if (cErr) {
      setToast('Could not load carriers')
      setLoading(false)
      return
    }
    setCarriers((cData || []) as CarrierRow[])

    // load products
    const { data: pData, error: pErr } = await supabase
      .from('carrier_products')
      .select('id,carrier_id,product_name,sort_order,is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('product_name', { ascending: true })

    if (pErr) {
      setToast('Could not load products')
      setLoading(false)
      return
    }
    setProducts((pData || []) as ProductRow[])

    setLoading(false)
  }

  const productsForCarrier = useMemo(() => {
    if (!carrierId) return []
    return products.filter((p) => p.carrier_id === carrierId)
  }, [products, carrierId])

  useEffect(() => {
    // reset product if carrier changes
    setProductName('')
  }, [carrierId])

  function onPhoneChange(v: string) {
    setPhone(formatPhoneLive(v))
  }

  function onMoneyChange(v: string, setter: (s: string) => void) {
    setter(formatMoneyLive(v))
  }

  async function fireDiscordWebhook(dealId: string) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    await fetch('/api/webhooks/deal-posted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deal_id: dealId }),
    }).catch(() => {})
  }

  async function submit() {
    try {
      setToast(null)

      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) {
        router.push('/login')
        return
      }

      if (!fullName.trim()) return setToast('Full name required')
      if (!carrierId) return setToast('Select a company')
      if (!productName) return setToast('Select a product')

      const carrier = carriers.find((c) => c.id === carrierId)

      const payload: any = {
        agent_id: user.id,
        full_name: fullName.trim(),
        phone: normalizePhone(phone),
        dob: dob || null,
        effective_date: effectiveDate || null,
        carrier_id: carrierId,
        company: carrier?.name || null,
        product: productName || null,
        policy_number: policyNumber.trim() || null,
        coverage: moneyToNumber(coverage),
        premium: moneyToNumber(premium),
        relationship: relationship || null,
        notes: notes.trim() || null,
        note: notes.trim() || null, // keep compatibility with your Deal House note/notes
        status: 'pending',
      }

      const { data: inserted, error } = await supabase
        .from('deals')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        setToast(error.message || 'Submit failed')
        return
      }

      // ✅ Discord webhook fire
      if (inserted?.id) fireDiscordWebhook(inserted.id)

      // ✅ Route back to dashboard and refresh
      router.push('/dashboard')
      router.refresh()
    } catch (e: any) {
      setToast(e?.message || 'Submit failed')
    }
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
            <h1 className="text-3xl font-semibold tracking-tight">Post a Deal</h1>
            <p className="text-sm text-white/60 mt-1">Modern glass form. Carrier → Product → Submit.</p>
          </div>

          <button onClick={boot} className={btnGlass}>
            Refresh
          </button>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-6">
          {loading ? (
            <div className="px-6 py-10 text-center text-white/60">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>

                <Field label="Phone Number">
                  <input
                    className={inputCls}
                    value={phone}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    placeholder="(888) 888-8888"
                  />
                </Field>

                <Field label="DOB">
                  <FlowDatePicker value={dob} onChange={setDob} placeholder="Select DOB" />
                </Field>

                <Field label="Effective Date">
                  <FlowDatePicker value={effectiveDate} onChange={setEffectiveDate} placeholder="Select effective date" />
                </Field>

                <Field label="Company">
                  <select className={inputCls} value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
                    <option value="">Select…</option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Product">
                  <select
                    className={[
                      inputCls,
                      !carrierId ? 'opacity-50 cursor-not-allowed' : '',
                    ].join(' ')}
                    disabled={!carrierId}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  >
                    <option value="">{carrierId ? 'Select…' : 'Select carrier first…'}</option>
                    {productsForCarrier.map((p) => (
                      <option key={p.id} value={p.product_name}>
                        {p.product_name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Policy Number">
                  <input className={inputCls} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
                </Field>

                <Field label="Coverage">
                  <input
                    className={inputCls}
                    value={coverage}
                    onChange={(e) => onMoneyChange(e.target.value, setCoverage)}
                    placeholder="100,000.00"
                  />
                </Field>

                <Field label="Premium">
                  <input
                    className={inputCls}
                    value={premium}
                    onChange={(e) => onMoneyChange(e.target.value, setPremium)}
                    placeholder="1,200.00"
                  />
                </Field>

                <Field label="Relationship">
                  <select className={inputCls} value={relationship} onChange={(e) => setRelationship(e.target.value as any)}>
                    {RELATIONSHIP.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Notes">
                  <textarea
                    className={`${inputCls} min-h-[110px]`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything important…"
                  />
                </Field>
              </div>

              <button
                onClick={submit}
                className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-3 text-sm font-semibold"
              >
                Submit Deal
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

function formatPhoneLive(input: string) {
  const digits = (input || '').replace(/\D/g, '').slice(0, 10)
  const a = digits.slice(0, 3)
  const b = digits.slice(3, 6)
  const c = digits.slice(6, 10)

  if (digits.length <= 3) return a ? `(${a}` : ''
  if (digits.length <= 6) return `(${a}) ${b}`
  return `(${a}) ${b}-${c}`
}

function normalizePhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length !== 10) return raw?.trim() || null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function formatMoneyLive(input: string) {
  // allow typing; keep only digits + dot, then apply commas + 2 decimals
  const cleaned = (input || '').replace(/[^0-9.]/g, '')
  if (!cleaned) return ''
  const parts = cleaned.split('.')
  const intPart = parts[0] || ''
  const decPart = (parts[1] || '').slice(0, 2)

  const intNum = Number(intPart || '0')
  const intFmt = intNum.toLocaleString()

  if (cleaned.includes('.')) return `${intFmt}.${decPart.padEnd(decPart.length ? decPart.length : 0, '0')}`
  return intFmt
}

function moneyToNumber(v: string) {
  const n = Number(String(v || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
