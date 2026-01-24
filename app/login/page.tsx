// /app/login/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'pin' | 'reset'>('login')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // ✅ PIN mode (6 digits)
  const [pin, setPin] = useState('')

  // ✅ Forced password setup modal
  const [setPwOpen, setSetPwOpen] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const appUrl =
    (process.env.NEXT_PUBLIC_APP_URL || '').trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) window.location.href = '/dashboard'
    })()
  }, [])

  const canSubmit = useMemo(() => {
    const e = email.trim()
    if (!e.includes('@')) return false
    if (mode === 'reset') return true
    if (mode === 'pin') return pin.trim().length === 6
    return password.length >= 6
  }, [email, password, pin, mode])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    try {
      setLoading(true)
      setToast(null)

      // ✅ Normal login (email + password)
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error

        const uid = data.user?.id
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('must_set_password')
            .eq('id', uid)
            .single()

          if (prof?.must_set_password) {
            setSetPwOpen(true)
            return
          }
        }

        window.location.href = '/dashboard'
        return
      }

      // ✅ PIN login (email + pin as temp password)
      if (mode === 'pin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pin.trim(),
        })
        if (error) throw error

        const uid = data.user?.id
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('must_set_password')
            .eq('id', uid)
            .single()

          if (prof?.must_set_password) {
            setSetPwOpen(true)
            return
          }
        }

        window.location.href = '/dashboard'
        return
      }

      // ✅ reset
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appUrl}/reset-password`,
      })
      if (error) throw error

      setToast('Password reset email sent ✅')
      setMode('login')
    } catch (err: any) {
      setToast(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function saveNewPassword() {
    if (!newPw || newPw.length < 6) {
      setToast('Password must be at least 6 characters')
      return
    }
    if (newPw !== newPw2) {
      setToast('Passwords do not match')
      return
    }

    try {
      setPwSaving(true)
      setToast(null)

      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) throw new Error('Not logged in')

      const { error: upErr } = await supabase.auth.updateUser({ password: newPw })
      if (upErr) throw upErr

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ must_set_password: false })
        .eq('id', uid)

      if (profErr) throw profErr

      setSetPwOpen(false)
      setNewPw('')
      setNewPw2('')
      window.location.href = '/dashboard'
    } catch (e: any) {
      setToast(e?.message || 'Could not set password')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white flex items-center justify-center px-6 py-10">
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <div className="glass px-5 py-4 rounded-2xl border border-white/10 shadow-2xl max-w-[360px]">
            <div className="text-sm font-semibold">{toast}</div>
            <div className="mt-3">
              <button className={btnSoft} onClick={() => setToast(null)} type="button">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Force password modal */}
      {setPwOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md glass rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="text-sm font-semibold">Set password to continue</div>
                <div className="text-xs text-white/60 mt-1">This is required on your first login.</div>
              </div>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  setSetPwOpen(false)
                }}
                className={btnSoft}
                type="button"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3">
              <Field label="New password">
                <input
                  className={inputCls}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>

              <Field label="Confirm new password">
                <input
                  className={inputCls}
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </Field>

              <button
                onClick={saveNewPassword}
                disabled={pwSaving}
                className={[
                  'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition border',
                  pwSaving
                    ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                    : 'bg-blue-600 border-blue-500/60 hover:bg-blue-500',
                ].join(' ')}
                type="button"
              >
                {pwSaving ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[980px] grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-3xl border border-white/10 p-8 overflow-hidden relative">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative">
            <div className="text-xs text-white/60">Out With The Old, In With The New</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-2">Flow</h1>
            <p className="text-sm text-white/60 mt-3 leading-relaxed">
              A CRM for agents who want to submit business fast and track production cleanly.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Feature label="Fast tracking" desc="Post deals in seconds." />
              <Feature label="Follow ups" desc="No deals slipping." />
              <Feature label="Leaderboards" desc="Competitive output." />
              <Feature label="Analytics" desc="Clean signal." />
            </div>

            <div className="mt-8 text-xs text-white/50">By continuing you agree to your agency’s policies.</div>
          </div>
        </div>

        <div className="glass rounded-3xl border border-white/10 p-8">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">
              {mode === 'login' ? 'Log in' : mode === 'pin' ? 'Log in with PIN' : 'Reset password'}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <button onClick={() => setMode('login')} className={pill(mode === 'login')} type="button">
              Login
            </button>
            <button onClick={() => setMode('pin')} className={pill(mode === 'pin')} type="button">
              PIN
            </button>
            <button onClick={() => setMode('reset')} className={pill(mode === 'reset')} type="button">
              Forgot
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Email">
              <input
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </Field>

            {mode !== 'reset' && mode !== 'pin' && (
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
            )}

            {mode === 'pin' && (
              <Field label="6-digit PIN code">
                <input
                  className={inputCls}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                />
              </Field>
            )}

            <button
              disabled={loading || !canSubmit}
              className={[
                'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition border',
                loading || !canSubmit
                  ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-blue-600 border-blue-500/60 hover:bg-blue-500',
              ].join(' ')}
              type="submit"
            >
              {loading ? 'Working…' : mode === 'login' ? 'Log in' : mode === 'pin' ? 'Log in with PIN' : 'Send reset email'}
            </button>

            <div className="flex items-center justify-between text-xs text-white/60 pt-2">
              <button type="button" className="hover:underline" onClick={() => setMode('reset')}>
                Forgot password?
              </button>

              <button
                type="button"
                className="text-white/80 hover:underline"
                onClick={() => setMode(mode === 'pin' ? 'login' : 'pin')}
              >
                {mode === 'pin' ? 'Use password instead' : 'Login with PIN'}
              </button>
            </div>

            <div className="text-[11px] text-white/45 pt-2">
              Trouble logging in? Use the email you were invited with. If you have a PIN, choose “PIN”.
            </div>
          </form>
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

function Feature({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-white/60 mt-1">{desc}</div>
    </div>
  )
}

function pill(active: boolean) {
  return [
    'rounded-2xl border px-3 py-2 text-xs font-semibold transition',
    active ? 'bg-white/10 border-white/15' : 'bg-white/5 border-white/10 hover:bg-white/10',
  ].join(' ')
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/7'

const btnSoft = 'rounded-xl bg-white/10 hover:bg-white/15 transition px-3 py-2 text-xs'
