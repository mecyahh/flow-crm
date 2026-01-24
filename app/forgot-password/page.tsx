// ✅ FULL REPLACEMENT FILE: /app/reset-password/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function errMsg(e: any) {
  return e?.message || e?.error_description || e?.error || 'Something failed'
}

function minLenOk(pw: string) {
  return (pw || '').trim().length >= 8
}

export default function ResetPasswordPage() {
  const router = useRouter()

  const [booting, setBooting] = useState(true)
  const [ready, setReady] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const canSubmit = useMemo(() => {
    if (!ready) return false
    if (!minLenOk(pw1)) return false
    if (pw1.trim() !== pw2.trim()) return false
    return true
  }, [ready, pw1, pw2])

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function boot() {
    setBooting(true)
    setToast(null)

    try {
      /**
       * ✅ "Read the Supabase session from URL"
       * Supabase password recovery links include tokens in the URL (often in the hash).
       * supabase-js will process these automatically when the page loads.
       */
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error

      if (!data.session) {
        // Sometimes the hash isn't processed instantly; retry once for smoother UX.
        await new Promise((r) => setTimeout(r, 200))
        const { data: retry } = await supabase.auth.getSession()

        if (!retry.session) {
          setReady(false)
          setToast('Reset link is invalid or expired. Please request a new reset email.')
          return
        }
      }

      setReady(true)
    } catch (e: any) {
      setReady(false)
      setToast(`Could not verify reset link: ${errMsg(e)}`)
    } finally {
      setBooting(false)
    }
  }

  async function submit() {
    setToast(null)

    const a = pw1.trim()
    const b = pw2.trim()

    if (!ready) {
      setToast('Reset session not found. Please request a new reset email.')
      return
    }
    if (!minLenOk(a)) {
      setToast('Password must be at least 8 characters.')
      return
    }
    if (a !== b) {
      setToast('Passwords do not match.')
      return
    }

    try {
      setSaving(true)

      // ✅ Set new password (requires recovery session from URL)
      const { error } = await supabase.auth.updateUser({ password: a })
      if (error) throw error

      setToast('Password updated ✅ Redirecting to login…')

      // ✅ Clean login flow (optional but helps avoid weird state)
      await supabase.auth.signOut().catch(() => {})

      setTimeout(() => {
        router.push('/login') // https://app.yourflowcrm.com/login
      }, 650)
    } catch (e: any) {
      setToast(`Reset failed: ${errMsg(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      {toast && (
        <div className="fixed top-5 right-5 z-[999]">
          <div className="glass px-5 py-4 rounded-2xl border border-[var(--cardBorder)] shadow-2xl">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnSoft} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md glass rounded-2xl border border-[var(--cardBorder)] p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Set a new password. After saving, you’ll be redirected to login.
          </p>
        </div>

        {booting ? (
          <div className="rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] p-4">
            <div className="text-sm text-[var(--muted)]">Verifying reset link…</div>
          </div>
        ) : !ready ? (
          <div className="rounded-2xl border border-[var(--cardBorder)] bg-[var(--card)] p-4">
            <div className="text-sm font-semibold">Reset link problem</div>
            <div className="text-sm text-[var(--muted)] mt-1">
              Your reset link is invalid or expired. Go back to login and request a new reset email.
            </div>

            <button
              className={btnGlass + ' mt-4 w-full'}
              onClick={() => router.push('/login')}
              type="button"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              <Field label="New password">
                <input
                  className={inputCls}
                  type={show ? 'text' : 'password'}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </Field>

              <Field label="Confirm new password">
                <input
                  className={inputCls}
                  type={show ? 'text' : 'password'}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Re-type password"
                  autoComplete="new-password"
                />
              </Field>

              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className={btnGlass}
              >
                {show ? 'Hide password' : 'Show password'}
              </button>
            </div>

            <button
              onClick={submit}
              disabled={!canSubmit || saving}
              className={saveWide + (!canSubmit || saving ? ' opacity-50 cursor-not-allowed' : '')}
            >
              {saving ? 'Saving…' : 'Update Password'}
            </button>

            <div className="mt-3 text-[11px] text-[var(--muted2)]">
              You’ll be redirected to <span className="text-white/70">/login</span> after success.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- UI bits (match your app style) ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--muted)] mb-2">{label}</div>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10 placeholder:text-white/40'

const btnGlass =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const saveWide =
  'mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-[0_0_0_1px_rgba(255,255,255,0.08)] bg-[var(--accent)] hover:opacity-90 text-[var(--accentText)]'
