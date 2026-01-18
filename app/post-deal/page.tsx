'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type CarrierRow = {
  id: string
  custom_name: string | null
  supported_name: string | null
  advance_rate: number | null
}

type ProductRow = {
  id: string
  carrier_id: string
  name: string
}

type CarrierOption = {
  id: string
  label: string
  supported_name: string
  products: { id: string; name: string }[]
}

export default function PostDealPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // carriers/products
  const [carriers, setCarriers] = useState<CarrierOption[]>([])
  const [carrierId, setCarrierId] = useState('')
  const [productId, setProductId] = useState('')

  // form
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [coverage, setCoverage] = useState('') // string for formatting
  const [premium, setPremium] = useState('') // string for formatting
  const [note, setNote] = useState('')

  const selectedCarrier = useMemo(
    () => carriers.find((c) => c.id === carrierId) || null,
    [carriers, carrierId]
  )

  const productOptions = useMemo(() => {
    if (!selectedCarrier) return []
    return selectedCarrier.products
  }, [selectedCarrier])

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setLoading(true)

    // ensure auth
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) {
      window.location.href = '/login'
      return
    }

    // load carriers + products (from Settings tables)
    // carriers
    const { data: cData, error: cErr } = await supabase
      .from('carriers')
      .select('id, custom_name, supported_name, advance_rate')
      .order('custom_name', { ascending: true })
      .limit(500)

    if (cErr) {
      setToast('Could not load carriers (RLS?)')
      setLoading(false)
      return
    }

    const carriersList = (cData || []) as CarrierRow[]
    const carrierIds = carriersList.map((c) => c.id)

    // products
    const { data: pData, error: pErr } = await supabase
      .from('carrier_products')
      .select('id, carrier_id, name')
      .in('carrier_id', carrierIds.length ? carrierIds : ['00000000-0000-0000-0000-000000000000'])
      .order('name', { ascending: true })
      .limit(2000)

    if (pErr) {
      setToast('Could not load products (RLS?)')
      setLoading(false)
      return
    }

    const productsList = (pData || []) as ProductRow[]

    const options: CarrierOption[] = carriersList.map((c) => {
      const label = (c.custom_name || c.supported_name || 'Carrier').trim()
      const supported = (c.supported_name || c.custom_name || label).trim()
      const products = productsList
        .filter((p) => p.carrier_id === c.id)
        .map((p) => ({ id: p.id, name: p.name }))

      return { id: c.id, label, supported_name: supported, products }
    })

    setCarriers(options)
    setLoading(false)
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

      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw new Error(userErr.message)
      const user = userRes.user
      if (!user) {
        window.location.href = '/login'
        return
      }

      // validations
      if (!fullName.trim()) return setToast('Full Name is required')
      if (!carrierId) return setToast('Select a Company')
      if (!productId) return setToast('Select a Product')
      if (!dob) return setToast('DOB is required')

      const covNum = toMoneyNumber(coverage)
      const premNum = toMoneyNumber(premium)

      if (!covNum || covNum <= 0) return setToast('Coverage is required')
      if (!premNum || premNum <= 0) return setToast('Premium is required')

      const carrier = selectedCarrier
      const product = productOptions.find((p) => p.id === productId)

      // insert
      const payload = {
        agent_id: user.id,
        full_name: fullName.trim(),
        phone: cleanPhone(phone),
        dob,
        company: carrier?.label || null,
        policy_number: policyNumber.trim() || null,
        coverage: covNum,
        premium: premNum,
        product: product?.name || null,
        note: note.trim() || null,
      }

      const { data: inserted, error } = await supabase
        .from('deals')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw new Error(error.message)

      // webhook
      if (inserted?.id) fireDiscordWebhook(inserted.id)

      // route to dashboard (refreshed)
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
            <p className="text-sm text-white/60 mt-1">Fast. Clean. Glass. No double-entry.</p>
          </div>

          <button onClick={() => router.push('/dashboard')} className={btnGlass}>
            Back to Dashboard
          </button>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-6">
          {loading ? (
            <div className="py-10 text-center text-white/60">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Full Name">
                  <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>

                <Field label="Phone">
                  <input
                    className={inputCls}
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneLive(e.target.value))}
                    placeholder="(888) 888-8888"
                  />
                </Field>

                <Field label="DOB">
                  <FlowDatePicker value={dob} onChange={setDob} placeholder="Select DOB" />
                </Field>

                <Field label="Company">
                  <select
                    className={inputCls}
                    value={carrierId}
                    onChange={(e) => {
                      const id = e.target.value
                      setCarrierId(id)
                      setProductId('') // reset product when carrier changes
                    }}
                  >
                    <option value="">Select…</option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Product">
                  <select
                    className={[inputCls, !carrierId ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
                    value={productId}
                    disabled={!carrierId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">{carrierId ? 'Select…' : 'Select a carrier first…'}</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Policy #">
                  <input className={inputCls} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
                </Field>

                <Field label="Coverage">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={coverage}
                    onChange={(e) => setCoverage(sanitizeMoneyLive(e.target.value))}
                    onBlur={() => setCoverage(formatMoneyString(coverage))}
                    placeholder="100,000.00"
                  />
                </Field>

                <Field label="Premium">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={premium}
                    onChange={(e) => setPremium(sanitizeMoneyLive(e.target.value))}
                    onBlur={() => setPremium(formatMoneyString(premium))}
                    placeholder="250.00"
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Notes">
                  <textarea
                    className={`${inputCls} min-h-[120px]`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Quick notes…"
                  />
                </Field>
              </div>

              <button
                onClick={submit}
                className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-500 transition px-4 py-3 text-sm font-semibold"
              >
                Submit Deal
              </button>

              <div className="mt-3 text-[11px] text-white/45">
                Submits to Deal House + fires Discord webhook automatically.
              </div>
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

/* -------- formatting helpers -------- */

function cleanPhone(raw: string) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length !== 10) return raw?.trim() || null
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function formatPhoneLive(v: string) {
  const digits = (v || '').replace(/\D/g, '').slice(0, 10)
  const a = digits.slice(0, 3)
  const b = digits.slice(3, 6)
  const c = digits.slice(6, 10)

  if (digits.length <= 3) return a ? `(${a}` : ''
  if (digits.length <= 6) return `(${a}) ${b}`
  return `(${a}) ${b}-${c}`
}

function sanitizeMoneyLive(v: string) {
  // keep digits + 1 dot
  let s = (v || '').replace(/[^0-9.]/g, '')
  const parts = s.split('.')
  if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('')
  return s
}

function toMoneyNumber(v: string) {
  if (!v) return null
  const num = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(num) ? num : null
}

function formatMoneyString(v: string) {
  const n = toMoneyNumber(v)
  if (!n && n !== 0) return ''
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
