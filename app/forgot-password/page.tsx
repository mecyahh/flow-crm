'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function sendReset() {
    setBusy(true)
    setToast(null)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (error) throw error
      setToast('Reset email sent ✅ Check your inbox/spam.')
    } catch (e: any) {
      setToast(e?.message || 'Could not send reset email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4">
      <div className="w-full max-w-md glass rounded-2xl border border-white/10 p-6">
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="text-sm text-white/60 mt-1">We’ll email you a reset link.</p>

        {toast && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            {toast}
          </div>
        )}

        <div className="mt-5">
          <label className="text-[11px] text-white/60">Email</label>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20 focus:bg-white/10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>

        <button
          onClick={sendReset}
          disabled={busy}
          className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition bg-[var(--accent)] text-[var(--accentText)] hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send reset link'}
        </button>

        <a className="mt-4 block text-sm text-white/60 hover:text-white" href="/login">
          Back to login
        </a>
      </div>
    </div>
  )
}
