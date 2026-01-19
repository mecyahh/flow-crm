'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Carrier = {
  id: string
  custom_name: string
  supported_name: string
}

type Product = {
  id: string
  product_name: string
  carrier_id: string
}

export default function PostDealPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [carrierId, setCarrierId] = useState('')
  const [productId, setProductId] = useState('')

  const [full_name, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [coverage, setCoverage] = useState('')
  const [premium, setPremium] = useState('')
  const [policy_number, setPolicyNumber] = useState('')

  useEffect(() => {
    boot()
  }, [])

  async function boot() {
    const { data: u } = await supabase.auth.getUser()
    if (!u.user) {
      router.push('/login')
      return
    }

    const { data: c } = await supabase
      .from('carriers')
      .select('id,custom_name,supported_name')
      .eq('is_active', true)
      .order('custom_name')

    setCarriers((c || []) as Carrier[])
    setLoading(false)
  }

  useEffect(() => {
    if (!carrierId) {
      setProducts([])
      setProductId('')
      return
    }

    ;(async () => {
      const { data } = await supabase
        .from('carrier_products')
        .select('id,product_name,carrier_id')
        .eq('carrier_id', carrierId)
        .eq('is_active', true)
        .order('sort_order')

      setProducts((data || []) as Product[])
    })()
  }, [carrierId])

  const filteredProducts = useMemo(() => products, [products])

  async function fireDiscordWebhook(dealId: string) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return

    await fetch('/api/webhooks/deal-posted', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ deal_id: dealId }),
    }).catch(() => {})
  }

  async function submitDeal() {
    const { data: u } = await supabase.auth.getUser()
    const uid = u.user?.id
    if (!uid) return setToast('Not logged in')

    if (!carrierId || !productId) return setToast('Select carrier + product')

    const payload = {
      agent_id: uid,        // ✅ REQUIRED FOR RLS
      user_id: uid,
      full_name: full_name.trim() || null,
      phone: cleanPhone(phone),
      company: carriers.find(c => c.id === carrierId)?.custom_name || null,
      product_id: productId,
      coverage: toNum(coverage),
      premium: toNum(premium),
      policy_number: policy_number.trim() || null,
      status: 'submitted',
    }

    const { data: inserted, error } = await supabase
      .from('deals')
      .insert(payload)
      .select('id')
      .single()

    if (error) return setToast(error.message)

    if (inserted?.id) {
      await fireDiscordWebhook(inserted.id)
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10">
            <div className="text-sm font-semibold">{toast}</div>
            <button className="mt-3 btn-soft" onClick={() => setToast(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="ml-64 px-10 py-10">
        <h1 className="text-3xl font-semibold mb-6">Post a Deal</h1>

        {loading ? (
          <div className="text-white/60">Loading…</div>
        ) : (
          <div className="glass rounded-2xl border border-white/10 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">

            <Field label="Client Name">
              <input className={inputCls} value={full_name} onChange={e => setFullName(e.target.value)} />
            </Field>

            <Field label="Phone">
              <input
                className={inputCls}
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="(888) 888-8888"
              />
            </Field>

            <Field label="Carrier">
              <select className={inputCls} value={carrierId} onChange={e => setCarrierId(e.target.value)}>
                <option value="">Select carrier…</option>
                {carriers.map(c => (
                  <option key={c.id} value={c.id}>{c.custom_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Product">
              <select
                className={inputCls}
                value={productId}
                disabled={!carrierId}
                onChange={e => setProductId(e.target.value)}
              >
                <option value="">Select product…</option>
                {filteredProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            </Field>

            <Field label="Coverage">
              <input className={inputCls} value={coverage} onChange={e => setCoverage(e.target.value)} />
            </Field>

            <Field label="Premium">
              <input className={inputCls} value={premium} onChange={e => setPremium(e.target.value)} />
            </Field>

            <Field label="Policy #">
              <input className={inputCls} value={policy_number} onChange={e => setPolicyNumber(e.target.value)} />
            </Field>

            <button
              onClick={submitDeal}
              className="col-span-full mt-4 rounded-2xl bg-green-600 hover:bg-green-500 px-4 py-3 font-semibold"
            >
              Submit Deal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/55 mb-2">{label}</div>
      {children}
    </div>
  )
}

function toNum(v: string) {
  const n = Number(v.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function cleanPhone(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length !== 10) return null
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20'
