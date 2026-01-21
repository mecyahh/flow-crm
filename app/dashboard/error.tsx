// ✅ FILE: /app/dashboard/error.tsx  (CREATE THIS FILE)
// This catches client-side crashes on the Dashboard route and shows a clean UI instead of "Aw, Snap!"

'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel2)] backdrop-blur-xl p-6 max-w-xl w-full">
        <div className="text-xl font-semibold">Dashboard crashed</div>
        <div className="mt-2 text-sm text-[var(--text)]/70">{error?.message || 'Unknown error'}</div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => reset()}
            className="rounded-xl border border-[var(--border)] bg-[var(--panel2)] hover:bg-white/20 transition px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
          <a
            href="/login"
            className="rounded-xl bg-blue-600 hover:bg-blue-500 transition px-4 py-2 text-sm font-semibold"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  )
}
