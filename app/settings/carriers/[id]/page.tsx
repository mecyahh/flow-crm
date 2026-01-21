// app/settings/carriers/[id]/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  id: string
  role: string | null
}

type CarrierRow = {
  id: string
  custom_name: string | null
  supported_name: string | null
  advance_rate: number | null
  active: boolean | null
}

type ProductRow = {
  id: string
  carrier_id: string
  name: string | null
  created_at: string
}

type CompRow = {
  id: string
  product_id: string
  comp_level: number
  rate: number | null
}

const COMP_LEVELS_A = [115, 105, 100, 95, 90, 85, 80, 75, 70, 65, 60] as const
const COMP_LEVELS_B = [125, 115, 110, 105, 100, 95, 90, 85, 80, 75, 70] as const

export default function CarrierDetailPage() {
  const router = useRouter()
  const params = useParams()
  const carrierId = String((params as any)?.id || '')

  const [toast, setToast] = useState<string | null>(null)
  const [me, setMe] = useState<Profile | null>(null)

  const [loading, setLoading] = useState(true)
  const [carrier, setCarrier] = useState<CarrierRow | null>(null)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [comps, setComps] = useState<CompRow[]>([])

  const [createProductOpen, setCreateProductOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: 'Final Expense (Modified)', schema: 'A' as 'A' | 'B' })

  useEffect(() => {
    if (!carrierId) return
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierId])

  async function boot() {
    setLoading(true)

    const { data: ures, error: uerr } = await supabase.auth.getUser()
    if (uerr) {
      setToast(`auth.getUser: ${uerr.message}`)
      setLoading(false)
      return
    }
    const uid = ures.user?.id
    if (!uid) {
      window.location.href = '/login'
      return
    }

    const { data: prof, error: perr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', uid)
      .single()

    if (perr || !prof) {
      setToast('Could not load profile')
      setLoading(false)
      return
    }

    const p = prof as Profile
    setMe(p)

    if ((p.role || '').toLowerCase() !== 'admin') {
      setToast('Locked: Admins only')
      setLoading(false)
      return
    }

    await loadAll()
    setLoading(false)
  }

  async function loadAll() {
    const { data: cdata, error: cerr } = await supabase
      .from('carriers')
      .select('id, custom_name, supported_name, advance_rate, active')
      .eq('id', carrierId)
      .single()

    if (cerr || !cdata) {
      setToast('Could not load carrier (RLS?)')
      setCarrier(null)
      return
    }

    setCarrier(cdata as CarrierRow)

    const { data: pdata, error: perr } = await supabase
      .from('carrier_products')
      .select('id, carrier_id, name, created_at')
      .eq('carrier_id', carrierId)
      .order('created_at', { ascending: true })
      .limit(2000)

    if (perr) {
      setToast('Could not load products')
      setProducts([])
      setComps([])
      return
    }

    const prows = (pdata || []) as ProductRow[]
    setProducts(prows)

    if (!prows.length) {
      setComps([])
      return
    }

    const { data: crows, error: cerr2 } = await supabase
      .from('carrier_product_comp')
      .select('id, product_id, comp_level, rate')
      .in(
        'product_id',
        prows.map((p) => p.id)
      )
      .limit(5000)

    if (cerr2) {
      setToast('Could not load comp table')
      setComps([])
      return
    }

    setComps((crows || []) as CompRow[])
  }

  const compMap = useMemo(() => {
    // key: `${productId}:${level}`
    const m = new Map<string, number | null>()
    for (const r of comps) m.set(`${r.product_id}:${r.comp_level}`, r.rate ?? null)
    return m
  }, [comps])

  function getLevelsForProduct(name: string | null) {
    const n = (name || '').toLowerCase()
    // crude default: modified -> schema A, preferred/standard -> schema B
    if (n.includes('preferred') || n.includes('standard')) return COMP_LEVELS_B
    if (n.includes('modified')) return COMP_LEVELS_A
    return COMP_LEVELS_A
  }

  async function createProduct() {
    if (!carrierId) return

    const { data: inserted, error } = await supabase
      .from('carrier_products')
      .insert({ carrier_id: carrierId, name: newProduct.name.trim() || null })
      .select('id, carrier_id, name, created_at')
      .single()

    if (error || !inserted) {
      setToast('Create product failed (RLS?)')
      return
    }

    // seed comp rows (blank rates)
    const levels = newProduct.schema === 'B' ? COMP_LEVELS_B : COMP_LEVELS_A
    const seed = levels.map((lvl) => ({ product_id: inserted.id, comp_level: lvl, rate: null }))

    await supabase.from('carrier_product_comp').insert(seed)

    setToast('Product created ✅')
    setCreateProductOpen(false)
    setNewProduct({ name: 'Final Expense (Modified)', schema: 'A' })
    loadAll()
  }

  async function saveRate(productId: string, level: number, rateStr: string) {
    const rate = toNum(rateStr)
    const { error } = await supabase
      .from('carrier_product_comp')
      .upsert(
        { product_id: productId, comp_level: level, rate },
        { onConflict: 'product_id,comp_level' }
      )

    if (error) {
      setToast('Save failed (RLS?)')
      return
    }

    setComps((prev) => {
      const next = prev.slice()
      const idx = next.findIndex((r) => r.product_id === productId && r.comp_level === level)
      if (idx >= 0) next[idx] = { ...next[idx], rate }
      else next.push({ id: `tmp-${productId}-${level}`, product_id: productId, comp_level: level, rate })
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar />

      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-[var(--border)] shadow-2xl">
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
            <h1 className="text-3xl font-semibold tracking-tight">
              {carrier?.custom_name || 'Carrier'} <span className="text-[var(--text)]/50">· Comp Sheet</span>
            </h1>
            <p className="text-sm text-[var(--text)]/60 mt-1">
              Supported: {carrier?.supported_name || '—'} · Advance rate: {carrier?.advance_rate ?? 0.75}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/settings/carriers')} className={btnGlass}>
              Back
            </button>
            <button onClick={() => setCreateProductOpen(true)} className={btnPink}>
              Add Product
            </button>
            <button onClick={loadAll} className={btnGlass}>
              Refresh
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-[var(--border)] p-6">
          {loading ? (
            <div className="py-10 text-center text-[var(--text)]/60">Loading…</div>
          ) : !carrier ? (
            <div className="py-10 text-center text-[var(--text)]/60">Carrier not found.</div>
          ) : (
            <>
              {products.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--text)]/70">
                  No products yet. Click <b>Add Product</b>.
                </div>
              ) : (
                <div className="space-y-6">
                  {products.map((p) => {
                    const levels = getLevelsForProduct(p.name)
                    return (
                      <div key={p.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden">
                        <div className="px-5 py-4 bg-[var(--panel)] flex items-center justify-between border-b border-[var(--border)]">
                          <div className="text-sm font-semibold">{p.name || 'Product'}</div>
                          <div className="text-xs text-[var(--text)]/55">Edit cells to save</div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="text-[11px] text-[var(--text)]/55">
                              <tr className="border-b border-[var(--border)]">
                                <th className={thSticky}>Comp</th>
                                {levels.map((lvl) => (
                                  <th key={lvl} className={thCenter}>
                                    {lvl.toFixed(2)}%
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-[var(--border)]">
                                <td className={tdSticky}>Rate</td>
                                {levels.map((lvl) => {
                                  const key = `${p.id}:${lvl}`
                                  const val = compMap.get(key)
                                  return (
                                    <td key={lvl} className={tdCenter}>
                                      <input
                                        className={cellInput}
                                        defaultValue={val ?? ''}
                                        placeholder="—"
                                        onBlur={(e) => saveRate(p.id, lvl, e.target.value)}
                                      />
                                    </td>
                                  )
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="px-5 py-4 text-[11px] text-[var(--text)]/55">
                          Tip: keep rates simple (example: <b>0.75</b>).
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ADD PRODUCT MODAL */}
      {createProductOpen && (
        <div className="fixed inset-0 bg-[var(--bg)]/60 flex items-center justify-center z-50 p-6">
          <div className="glass rounded-2xl border border-[var(--border)] p-6 w-full max-w-3xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-lg font-semibold">Add Product</div>
                <div className="text-xs text-[var(--text)]/55 mt-1">Creates a new comp table row set.</div>
              </div>

              <button onClick={() => setCreateProductOpen(false)} className={closeBtn}>
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Product name">
                <input
                  className={inputCls}
                  value={newProduct.name}
                  onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Final Expense (Preferred/Standard)"
                />
              </Field>

              <Field label="Comp schema">
                <select
                  className={inputCls}
                  value={newProduct.schema}
                  onChange={(e) => setNewProduct((p) => ({ ...p, schema: e.target.value as any }))}
                >
                  <option value="A">115/105/100/…/60</option>
                  <option value="B">125/115/110/…/70</option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setCreateProductOpen(false)} className={closeBtn}>
                Cancel
              </button>
              <button onClick={createProduct} className={btnPink}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
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

const inputCls =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'
const btnGlass =
  'glass px-4 py-2 text-sm font-medium hover:bg-[var(--panel2)] transition rounded-2xl border border-[var(--border)]'
const btnSoft = 'rounded-xl bg-[var(--panel2)] hover:bg-white/15 transition px-3 py-2 text-xs'
const closeBtn =
  'rounded-2xl border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel2)] transition px-4 py-3 text-sm font-semibold'
const btnPink =
  'rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 transition px-5 py-3 text-sm font-semibold'

const thSticky =
  'text-left px-5 py-3 whitespace-nowrap sticky left-0 bg-[var(--bg)] z-10 border-r border-[var(--border)]'
const thCenter = 'text-center px-5 py-3 whitespace-nowrap'
const tdSticky =
  'px-5 py-4 font-semibold whitespace-nowrap sticky left-0 bg-[var(--bg)] z-10 border-r border-[var(--border)]'
const tdCenter = 'px-5 py-4 text-center whitespace-nowrap'

const cellInput =
  'w-28 text-center rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none focus:border-white/20 focus:bg-[var(--panel2)]'
