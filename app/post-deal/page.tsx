'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import FlowDatePicker from '@/app/components/FlowDatePicker'

type Carrier = {
  id: string
  created_at?: string | null
  custom_name?: string | null
  name?: string | null
  supported_name?: string | null
  is_active?: boolean | null
}

type Product = {
  id: string
  carrier_id: string
  product_name: string
  sort_order: number | null
  is_active: boolean | null
}

export default function PostDealPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // locked fields
  const [clientName, setClientName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('') // YYYY-MM-DD
  const [effectiveDate, setEffectiveDate] = useState('') // YYYY-MM-DD

  const [carrierId, setCarrierId] = useState('')
  const [productId, setProductId] = useState('')

  const [coverageDisplay, setCoverageDisplay] = useState('')
  const [premiumDisplay, setPremiumDisplay] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function carrierLabel(c: Carrier) {
    return (c.custom_name || c.name || c.supported_name || '—').trim()
  }

  async function boot() {
    setLoading(true)

    const { data: u, error: uErr } = await supabase.auth.getUser()
    if (uErr || !u.user) {
      router.push('/login')
      return
    }

    // ✅ more forgiving select (works whether table uses name or custom_name)
    const { data: c, error } = await supabase
      .from('carriers')
      .select('id,created_at,custom_name,name,supported_name,is_active')
      .limit(5000)

    if (error) {
      setToast(`Could not load carriers: ${error.message}`)
      setCarriers([])
      setLoading(false)
      return
    }

    // ✅ don’t depend on is_active existing; if present and false, hide it
    const cleaned = ((c || []) as Carrier[])
      .filter((x) => x.is_active !== false)
      .sort((a, b) => carrierLabel(a).toLowerCase().localeCompare(carrierLabel(b).toLowerCase()))

    setCarriers(cleaned)
    setLoading(false)

    if (cleaned.length === 0) {
      setToast('No carriers found. (Likely RLS or table empty)')
    }
  }

  // load products after carrier pick
  useEffect(() => {
    if (!carrierId) {
      setProducts([])
      setProductId('')
      return
    }

    ;(async () => {
      const { data, error } = await supabase
        .from('carrier_products')
        .select('id,carrier_id,product_name,sort_order,is_active')
        .eq('carrier_id', carrierId)
        .limit(5000)

      if (error) {
        setToast(`Could not load products: ${error.message}`)
        setProducts([])
        return
      }

      const list = ((data || []) as Product[])
        .filter((p) => p.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))

      setProducts(list)
    })()
  }, [carrierId])

  const productOptions = useMemo(() => products, [products])

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

  async function submitDeal() {
    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    if (!uid) return setToast('Not logged in')

    if (!clientName.trim()) return setToast('Client name required')
    if (!isValidPhone(phone)) return setToast('Phone must be (888) 888-8888')
    if (!dob) return setToast('DOB required')
    if (!effectiveDate) return setToast('Effective date required')
    if (!carrierId) return setToast('Carrier required')
    if (!productId) return setToast('Product required')

    const coverageNum = parseMoneyToNumber(coverageDisplay)
    const premiumNum = parseMoneyToNumber(premiumDisplay)

    if (coverageNum === null) return setToast('Coverage required')
    if (premiumNum === null) return setToast('Premium required')

    const carrier = carriers.find((c) => c.id === carrierId)
    const product = products.find((p) => p.id === productId)

    const payload: any = {
      // ✅ RLS-safe
      agent_id: uid,
      user_id: uid,

      full_name: clientName.trim(),
      phone: normalizePhone(phone),
      dob,
      effective_date: effectiveDate,

      // ✅ store the carrier label the user sees
      company: carrier ? carrierLabel(carrier) : null,

      product_name: product?.product_name || null,
      product_id: productId,

      coverage: coverageNum,
      premium: premiumNum,

      policy_number: policyNumber.trim() || null,
      status: 'submitted',
    }

    const { data: inserted, error } = await supabase.from('deals').insert(payload).select('id').single()
    if (error) return setToast(error.message)

    if (inserted?.id) await fireDiscordWebhook(inserted.id)

    router.push('/dashboard')
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
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Post a Deal</h1>
            <p className="text-sm text-white/60 mt-1">Locked form fields (never change).</p>
          </div>

          <button onClick={boot} className={btnGlass}>
            Refresh Carriers
          </button>
        </div>

        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Client Name">
                <input className={inputCls} value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </Field>

              <Field label="Phone">
                <input
                  className={inputCls}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(888) 888-8888"
                  inputMode="numeric"
                />
              </Field>

              <Field label="DOB">
                <FlowDatePicker value={dob} onChange={setDob} placeholder="Select DOB" />
              </Field>

              <Field label="Effective Date">
                <FlowDatePicker value={effectiveDate} onChange={setEffectiveDate} placeholder="Select effective date" />
              </Field>

              <Field label="Carrier">
                <select
                  className={inputCls}
                  value={carrierId}
                  onChange={(e) => {
                    setCarrierId(e.target.value)
                    setProductId('')
                  }}
                >
                  <option value="">Select carrier…</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {carrierLabel(c)}
                    </option>
                  ))}
                </select>
                {carriers.length === 0 && (
                  <div className="mt-2 text-xs text-red-300">
                    No carriers returned. This is either RLS blocking SELECT or the carriers table is empty.
                  </div>
                )}
              </Field>

              <Field label="Product">
                <select
                  className={inputCls}
                  value={productId}
                  disabled={!carrierId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">{carrierId ? 'Select product…' : 'Select carrier first…'}</option>
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Coverage">
                <input
                  className={inputCls}
                  value={coverageDisplay}
                  onChange={(e) => setCoverageDisplay(formatMoneyInput(e.target.value))}
                  placeholder="$100,000"
                  inputMode="numeric"
                />
              </Field>

              <Field label="Premium">
                <input
                  className={inputCls}
                  value={premiumDisplay}
                  onChange={(e) => setPremiumDisplay(formatMoneyInput(e.target.value))}
                  placeholder="$100"
                  inputMode="numeric"
                />
              </Field>

              <Field label="Policy #">
                <input className={inputCls} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
              </Field>
            </div>

            <button
              onClick={submitDeal}
              className="mt-6 w-full rounded-2xl bg-green-600 hover:bg-green-500 transition px-4 py-3 text-sm font-semibold"
            >
              Submit Deal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- helpers ---------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function digitsOnly(v: string) {
  return (v || '').replace(/\D/g, '')
}

function formatPhone(v: string) {
  const d = digitsOnly(v).slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function isValidPhone(v: string) {
  return /^\(\d{3}\)\s\d{3}-\d{4}$/.test(v)
}

function normalizePhone(v: string) {
  const d = digitsOnly(v)
  if (d.length !== 10) return null
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function formatMoneyInput(raw: string) {
  const cleaned = raw.replace(/[^0-9]/g, '')
  if (!cleaned) return ''
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return ''
  return `$${n.toLocaleString()}`
}

function parseMoneyToNumber(v: string): number | null {
  const cleaned = (v || '').replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
const btnGlass = 'glass px-4 py-2 text-sm font-medium hover:bg-white/10 transition rounded-2xl border border-white/10'
