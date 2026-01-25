'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

function errMsg(e: any) {
  return e?.message || e?.error_description || e?.error || 'Something failed'
}

type Mode = 'standard' | 'pin'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('standard')

  const [booting, setBooting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // PIN flow
  const [pinSent, setPinSent] = useState(false)
  const [pin, setPin] = useState('') // 6 digits

  const origin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), [])
  const callbackUrl = useMemo(() => `${origin}/auth/callback`, [origin])
  const resetUrl = useMemo(() => `${origin}/reset-password`, [origin])

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) {
          window.location.href = '/analytics'
          return
        }
      } catch {
        // ignore
      } finally {
        setBooting(false)
      }
    })()
  }, [])

  async function standardLogin() {
    setToast(null)
    const em = email.trim()
    if (!em) return setToast('Email is required')
    if (!password) return setToast('Password is required')

    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password })
      if (error) throw error
      window.location.href = '/analytics'
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function sendPin() {
    setToast(null)
    const em = email.trim()
    if (!em) return setToast('Enter your email first')

    setBusy(true)
    try {
      // This uses Supabase Auth email OTP / magic link.
      // With Resend SMTP configured in Supabase, it will send from your domain.
      const { error } = await supabase.auth.signInWithOtp({
        email: em,
        options: {
          // if your project sends magic links, this is where it returns
          emailRedirectTo: callbackUrl,
          shouldCreateUser: false,
        },
      })
      if (error) throw error

      setPinSent(true)
      setToast('PIN sent ✅ Check your email for a 6-digit code (or link).')
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function verifyPin() {
    setToast(null)
    const em = email.trim()
    const code = pin.replace(/\D/g, '').slice(0, 6)

    if (!em) return setToast('Email is required')
    if (code.length !== 6) return setToast('Enter the 6-digit PIN')

    setBusy(true)
    try {
      // Verify the OTP code
      const { error } = await supabase.auth.verifyOtp({
        email: em,
        token: code,
        type: 'email',
      })
      if (error) throw error

      window.location.href = '/analytics'
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function forgotPassword() {
    setToast(null)
    const em = email.trim()
    if (!em) return setToast('Enter your email first')

    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: resetUrl,
      })
      if (error) throw error

      setToast('Reset email sent ✅ Check your inbox.')
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const disabled = booting || busy

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-6">
      {toast && (
        <div className="fixed top-5 right-5 z-[999]">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl max-w-[360px]">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3 flex gap-2">
              <button className={btnSoft} onClick={() => setToast(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md glass rounded-2xl border border-white/10 p-8">
        {/* Brand */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="text-3xl font-semibold tracking-tight">Flow</div>
            <span className="text-[11px] px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 text-white/70">
              CRM
            </span>
          </div>
          <div className="text-sm text-white/60 mt-2">A CRM for top agents.</div>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('standard')
              setPinSent(false)
              setPin('')
              setToast(null)
            }}
            className={[
              tabBtn,
              mode === 'standard' ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
            ].join(' ')}
            disabled={disabled}
          >
            Standard
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('pin')
              setToast(null)
            }}
            className={[
              tabBtn,
              mode === 'pin' ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
            ].join(' ')}
            disabled={disabled}
          >
            Login with PIN
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Field label="Email">
            <input
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              inputMode="email"
            />
          </Field>

          {mode === 'standard' ? (
            <>
              <Field label="Password">
                <input
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </Field>

              <button onClick={standardLogin} disabled={disabled} className={saveWide + (disabled ? ' opacity-50 cursor-not-allowed' : '')}>
                {booting ? 'Loading…' : busy ? 'Logging in…' : 'Log in'}
              </button>
            </>
          ) : (
            <>
              {/* PIN Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={sendPin}
                  disabled={disabled}
                  className={btnGlass + (disabled ? ' opacity-50 cursor-not-allowed' : '')}
                >
                  {busy ? 'Sending…' : pinSent ? 'Resend PIN' : 'Send PIN'}
                </button>

                <button
                  type="button"
                  onClick={verifyPin}
                  disabled={disabled}
                  className={saveBtn + (disabled ? ' opacity-50 cursor-not-allowed' : '')}
                >
                  {busy ? 'Verifying…' : 'Verify & Login'}
                </button>
              </div>

              <Field label="6-digit PIN">
                <input
                  className={inputCls}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </Field>

              <div className="text-[11px] text-white/55">
                We’ll email you a 6-digit code. If you receive a link instead, click it — it will log you in automatically.
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={forgotPassword}
              disabled={disabled}
              className={linkBtn + (disabled ? ' opacity-50 cursor-not-allowed' : '')}
            >
              Forgot password / Reset password
            </button>
          </div>

          <div className="text-xs text-white/50 pt-2">
            Bookmark: <span className="text-white/70 font-semibold">https://app.yourflowcrm.com/login</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- UI bits ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-white/60 mb-2">{label}</div>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10 placeholder:text-white/40'

const tabBtn = 'rounded-2xl border px-4 py-2 text-sm font-semibold transition'

const btnGlass =
  'rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-3 text-sm font-semibold'

const saveBtn =
  'rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-[0_0_0_1px_rgba(255,255,255,0.08)] bg-[var(--accent)] hover:opacity-90 text-[var(--accentText)]'

const saveWide =
  'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-[0_0_0_1px_rgba(255,255,255,0.08)] bg-[var(--accent)] hover:opacity-90 text-[var(--accentText)]'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'

const linkBtn = 'text-sm font-semibold text-white/70 hover:text-white transition'
