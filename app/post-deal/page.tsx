// ✅ REPLACE ENTIRE FILE: /app/post-deal/page.tsx
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
  active: boolean | null
  sort_order: number | null
}

type ProductRow = {
  id: string
  carrier_id: string
  product_name: string
  sort_order: number | null
  is_active: boolean | null
}

export default function PostDealPage() {
  const router = useRouter()

  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [carriers, setCarriers] = useState<CarrierRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])

  // Form (LOCKED FIELDS)
  const [full_name, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('') // YYYY-MM-DD
  const [effective_date, setEffectiveDate] = useState('') // YYYY-MM-DD

  const [carrier_id, setCarrierId] = useState('')
  const [company, setCompany] = useState('') // deals.company
  const [product_name, setProductName] = useState('')

  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [policy_number, setPolicyNumber] = useState('')

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!carrier_id) {
      setProducts([])
      setProductName('')
      return
    }
    loadProducts(carrier_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier_id])

  async function boot() {
    setLoading(true)

    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    if (!uid) {
      window.location.href = '/login'
      return
    }

    const { data, error } = await supabase
      .from('carriers')
      .select('id,name,supported_name,active,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) {
      setToast(`Could not load carriers: ${error.message}`)
      setCarriers([])
      setLoading(false)
      return
    }

    const activeOnly = ((data || []) as CarrierRow[]).filter((c) => c.active !== false)
    setCarriers(activeOnly)
    setLoading(false)
  }

  async function loadProducts(cid: string) {
    const { data, error } = await supabase
      .from('carrier_products')
      .select('id,carrier_id,product_name,sort_order,is_active')
      .eq('carrier_id', cid)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) {
      setToast(`Could not load products: ${error.message}`)
      setProducts([])
      return
    }

    const activeOnly = ((data || []) as ProductRow[]).filter((p) => p.is_active !== false)
    setProducts(activeOnly)
  }

  const carrierOptions = useMemo(() => {
    return carriers.map((c) => ({
      id: c.id,
      label: c.name,
      supported_name: c.supported_name || c.name,
    }))
  }, [carriers])

  const productOptions = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      label: p.product_name,
    }))
  }, [products])

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
    if (saving) return
    setToast(null)

    const nameClean = full_name.trim()
    if (!nameClean) return setToast('Client name is required')

    if (!company.trim()) return setToast('Select a carrier')
    if (!product_name.trim()) return setToast('Select a product')

    const premNum = toMoneyNumber(premium)
    if (!Number.isFinite(premNum) || premNum <= 0) return setToast('Premium is required')

    const covNum = coverage ? toMoneyNumber(coverage) : null
    if (coverage && (!Number.isFinite(covNum as any) || (covNum as any) <= 0))
      return setToast('Coverage must be a valid number')

    setSaving(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) {
        window.location.href = '/login'
        return
      }

      // ✅ RLS-safe: set BOTH agent_id and user_id to the logged-in user
      const payload: any = {
        agent_id: uid,
        user_id: uid,

        full_name: nameClean,
        phone: phone ? phone : null,
        dob: dob || null,
        company: company.trim(),
        policy_number: policy_number.trim() || null,
        coverage: covNum,
        premium: premNum,

        status: 'submitted',
        // store extra fields without new columns
        note: buildNote({ product_name, effective_date }),
      }

      const { data: inserted, error } = await supabase.from('deals').insert(payload).select('id').single()
      if (error) throw new Error(error.message)

      if (inserted?.id) fireDiscordWebhook(inserted.id)

      // ✅ route back to dashboard with refreshed data
      router.push('/dashboard')
      router.refresh()
    } catch (e: any) {
      setToast(e?.message || 'Submit failed')
      setSaving(false)
      return
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
            <p className="text-sm text-white/60 mt-1">
              Vertical drop-aligned form — phone + money formatting locked.
            </p>
          </div>

          <button onClick={() => router.push('/dashboard')} className={btnGlass}>
            Back to Dashboard
          </button>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-6">
          {loading ? (
            <div className="px-6 py-10 text-center text-white/60">Loading…</div>
          ) : (
            <div className="max-w-2xl">
              {/* ✅ Vertical drop-aligned layout */}
              <div className="space-y-4">
                <Field label="Client Name">
                  <input
                    className={inputCls}
                    value={full_name}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Client name"
                  />
                </Field>

                <Field label="Phone">
                  <input
                    className={inputCls}
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(888) 888-8888"
                    inputMode="tel"
                  />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="DOB">
                    <FlowDatePicker value={dob} onChange={setDob} placeholder="Select DOB" />
                  </Field>

                  <Field label="Effective Date">
                    <FlowDatePicker value={effective_date} onChange={setEffectiveDate} placeholder="Select Effective Date" />
                  </Field>
                </div>

                <Field label="Carrier">
                  <select
                    className={inputCls}
                    value={carrier_id}
                    onChange={(e) => {
                      const cid = e.target.value
                      setCarrierId(cid)

                      const picked = carrierOptions.find((x) => x.id === cid)
                      const carrierName = picked?.label || ''
                      setCompany(carrierName)
                    }}
                  >
                    <option value="">Select carrier…</option>
                    {carrierOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Product">
                  <select
                    className={[inputCls, !carrier_id ? 'opacity-50 cursor-not-allowed' : ''].join(' ')}
                    value={product_name}
                    onChange={(e) => setProductName(e.target.value)}
                    disabled={!carrier_id}
                  >
                    <option value="">{carrier_id ? 'Select product…' : 'Select carrier first…'}</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Coverage">
                    <input
                      className={inputCls}
                      value={coverage}
                      onChange={(e) => setCoverage(moneyInput(e.target.value))}
                      onBlur={() => setCoverage(formatMoneyInput(coverage))}
                      placeholder="$100,000"
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Premium">
                    <input
                      className={inputCls}
                      value={premium}
                      onChange={(e) => setPremium(moneyInput(e.target.value))}
                      onBlur={() => setPremium(formatMoneyInput(premium))}
                      placeholder="$100"
                      inputMode="decimal"
                    />
                  </Field>
                </div>

                <Field label="Policy #">
                  <input
                    className={inputCls}
                    value={policy_number}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="Policy number"
                  />
                </Field>
              </div>

              <button
                onClick={submit}
                disabled={saving}
                className={[
                  'mt-6 w-full rounded-2xl transition px-4 py-3 text-sm font-semibold',
                  saving
                    ? 'bg-white/10 border border-white/10 text-white/60 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500',
                ].join(' ')}
              >
                {saving ? 'Submitting…' : 'Submit Deal'}
              </button>

              <div className="mt-3 text-[11px] text-white/50">
                Phone auto-formats. Coverage/Premium auto-format. Product disabled until carrier selected.
              </div>
            </div>
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

function formatPhone(input: string) {
  const digits = (input || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

// keep input money-ish while typing
function moneyInput(v: string) {
  const cleaned = String(v || '').replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
}

function toMoneyNumber(v: string) {
  const num = Number(String(v || '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(num) ? num : NaN
}

// format to $X,XXX on blur
function formatMoneyInput(v: string) {
  const n = toMoneyNumber(v)
  if (!Number.isFinite(n) || n === 0) return v ? '' : ''
  const whole = Math.round(n)
  return `$${whole.toLocaleString()}`
}

function buildNote({ product_name, effective_date }: { product_name: string; effective_date: string }) {
  const lines: string[] = []
  if (product_name) lines.push(`Product: ${product_name}`)
  if (effective_date) lines.push(`Effective: ${effective_date}`)
  return lines.length ? lines.join(' | ') : null
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
