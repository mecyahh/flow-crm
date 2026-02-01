'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

function errMsg(e: any) {
  return e?.message || e?.error_description || e?.error || 'Something failed'
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Resend reset
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)

  // ✅ Parse query params safely
  const { code, redirect } = useMemo(() => {
    if (typeof window === 'undefined') return { code: '', redirect: '' }
    const u = new URL(window.location.href)
    return {
      code: u.searchParams.get('code') || '',
      redirect: u.searchParams.get('redirect') || '',
    }
  }, [])

  const origin = useMemo(() => (typeof window !== 'undefined' ? window.location.origin : ''), [])
  const resetUrl = useMemo(() => `${origin}/reset-password`, [origin])

  useEffect(() => {
    ;(async () => {
      try {
        setToast(null)

        // 0) If they came from your email template:
        // /reset-password?redirect={{ .ConfirmationURL }}
        // We must exchange that URL (contains code) for a session.
        if (redirect) {
          const { error } = await supabase.auth.exchangeCodeForSession(redirect)
          if (error) throw error
        }

        // 1) PKCE direct flow: /reset-password?code=...
        if (!redirect && code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        }

        // 2) Hash token flow: /reset-password#access_token=...&refresh_token=...
        if (typeof window !== 'undefined' && window.location.hash?.includes('access_token=')) {
          const hash = window.location.hash.replace(/^#/, '')
          const params = new URLSearchParams(hash)
          const access_token = params.get('access_token') || ''
          const refresh_token = params.get('refresh_token') || ''

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token })
            if (error) throw error
          }
        }

        // 3) Confirm session exists
        const { data } = await supabase.auth.getSession()
        setReady(!!data.session)
      } catch (e: any) {
        setReady(false)
        setToast(errMsg(e))
      }
    })()
  }, [code, redirect])

  async function updatePassword() {
    setBusy(true)
    setToast(null)
    try {
      if (password.length < 8) throw new Error('Password must be at least 8 characters')

      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setToast('Password updated ✅ Redirecting…')
      setTimeout(() => (window.location.href = '/login'), 800)
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function resendReset() {
    setToast(null)
    setResent(false)

    const em = email.trim().toLowerCase()
    if (!em) return setToast('Enter your email to resend the reset link')

    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: resetUrl })
      if (error) throw error
      setResent(true)
      setToast('Reset email sent ✅ Check your inbox.')
    } catch (e: any) {
      setToast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl border border-white/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold">Reset password</h1>

          <button
            type="button"
            onClick={() => (window.location.href = '/login')}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 text-xs font-semibold"
          >
            Back to Login
          </button>
        </div>

        {!ready ? (
          <p className="text-sm text-white/60 mt-3">
            Open the reset link from your email in this same browser.
          </p>
        ) : (
          <p className="text-sm text-white/60 mt-3">Set a new password below.</p>
        )}

        {toast && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            {toast}
          </div>
        )}

        {!ready && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Resend reset link</div>
            <div className="text-xs text-white/60 mt-1">
              Enter your email and we’ll send a fresh reset link.
            </div>

            <div className="mt-3">
              <label className="text-[11px] text-white/60">Email</label>
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                inputMode="email"
                disabled={disabled}
              />
            </div>

            <button
              type="button"
              onClick={resendReset}
              disabled={disabled}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition bg-[var(--accent)] text-[var(--accentText)] hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send reset email'}
            </button>

            {resent && (
              <div className="mt-3 text-[11px] text-white/60">
                If you don’t see it, check Spam/Promotions.
              </div>
            )}
          </div>
        )}

        {ready && (
          <>
            <div className="mt-5">
              <label className="text-[11px] text-white/60">New Password</label>
              <input
                type="password"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                disabled={!ready || disabled}
                autoComplete="new-password"
              />
            </div>

            <button
              onClick={updatePassword}
              disabled={busy || !ready}
              className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition bg-[var(--accent)] text-[var(--accentText)] hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Update password'}
            </button>

            <div className="mt-3 text-[11px] text-white/55">
              After saving, you’ll be routed back to login automatically.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
