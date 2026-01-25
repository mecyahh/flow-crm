'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

export default function MarketingHome() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">
      {/* Glow blobs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-36 -left-36 h-[520px] w-[520px] rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-36 -right-36 h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-[22%] right-[10%] h-[380px] w-[380px] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      {/* Top Nav */}
      <header className="sticky top-0 z-50">
        <div className={['mx-auto max-w-6xl px-6', scrolled ? 'pt-4' : 'pt-6'].join(' ')}>
          <div
            className={[
              'relative flex items-center rounded-3xl border border-white/10 backdrop-blur-xl',
              scrolled ? 'bg-[var(--card)]/70 shadow-2xl' : 'bg-transparent',
              'px-5 py-3 transition',
            ].join(' ')}
          >
            {/* LEFT: nav links */}
            <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
              <a href="#features" className="hover:text-white transition">
                Features
              </a>
              <a href="#how" className="hover:text-white transition">
                How it works
              </a>
              <a href="#compliance" className="hover:text-white transition">
                Compliance
              </a>
              <Link href="/login" className="hover:text-white transition">
                Login
              </Link>
            </nav>

            {/* CENTER: logo */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
              {/* Semibold / Underline logo */}
              <div className="logo-wrapper">
                <span className="logo-text w-600 relative select-none">
                  flow
                  <span className="line-accent line-under" />
                </span>
              </div>
            </div>

            {/* RIGHT: CTAs */}
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-semibold"
              >
                Login
              </Link>
              <a
                href="mailto:support@mail.yourflowcrm.com?subject=Flow%20Demo%20Request"
                className="rounded-2xl bg-[var(--accent)] hover:opacity-90 transition px-4 py-2 text-sm font-semibold"
                style={{ color: 'var(--accentText)' as any }}
              >
                Request Demo
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pt-10 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="glass rounded-3xl border border-white/10 p-8 overflow-hidden relative">
              <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 text-[11px] text-white/70 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
                  <span className="w-2 h-2 rounded-full bg-green-400/70" />
                  Live, fast, built for high-output teams
                </div>

                <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight mt-4">
                  A modern CRM that keeps agents moving.
                </h1>

                <p className="text-sm text-white/60 mt-4 leading-relaxed">
                  Submit business in seconds, track production in real time, isolate team performance, and automate reporting
                  — all with a clean iOS-glass feel your agents will actually use.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/login"
                    className="rounded-2xl bg-[var(--accent)] hover:opacity-90 transition px-5 py-3 text-sm font-semibold text-center"
                    style={{ color: 'var(--accentText)' as any }}
                  >
                    Login
                  </Link>

                  <a
                    href="mailto:support@mail.yourflowcrm.com?subject=Flow%20Demo%20Request"
                    className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-5 py-3 text-sm font-semibold text-center"
                  >
                    Book a Demo
                  </a>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <StatCard title="Fast tracking" sub="Post deals in seconds." />
                  <StatCard title="Follow-ups" sub="No deals slipping." />
                  <StatCard title="Leaderboards" sub="Competitive output." />
                  <StatCard title="Analytics" sub="Clean signal. Clear action." />
                </div>

                <div className="mt-7 text-[11px] text-white/50">
                  By continuing, you agree to the Terms and acknowledge the Privacy Policy.
                </div>
              </div>
            </div>

            {/* Right preview panel */}
            <div className="glass rounded-3xl border border-white/10 p-8 relative overflow-hidden">
              <div className="absolute -top-28 right-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="text-sm font-semibold">What Flow does</div>
              <div className="text-xs text-white/60 mt-1">A simple system for daily execution.</div>

              <div className="mt-5 space-y-3">
                <PreviewRow title="Daily scoreboard" sub="Auto-post to Discord + email owners their isolated team numbers." />
                <PreviewRow title="Personal production isolation" sub="Agents see only their production (and their downline if they have one)." />
                <PreviewRow title="Goal tracking" sub="Personal goals + personal team goals. No agency leakage." />
                <PreviewRow title="Fast + clean UX" sub="Dark glass, iOS feel, zero clutter." />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/60">Typical use</div>
                <div className="mt-2 text-sm font-semibold">Deal → webhook → leaderboard → owner report</div>
                <div className="mt-2 text-[11px] text-white/55">
                  Designed for teams who want speed, accountability, and automated bookkeeping.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 pb-12">
          <div className="flex items-end justify-between gap-6 mb-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Features</h2>
              <p className="text-sm text-white/60 mt-1">Everything you need — nothing you don’t.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard title="Deal submission" desc="Agents post quickly with clean fields and automated AP." />
            <FeatureCard title="Team visibility" desc="Upline sees team totals. Agents see only their own numbers." />
            <FeatureCard title="Leaderboards" desc="Company leaderboard stays visible to drive performance." />
            <FeatureCard title="Analytics" desc="Range filters, carriers, trends, and breakdowns." />
            <FeatureCard title="Goals" desc="Personal goals + personal team goals — isolated and secure." />
            <FeatureCard title="Automation" desc="Scheduled emails, Discord updates, and future SMS reminders." />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl px-6 pb-12">
          <div className="glass rounded-3xl border border-white/10 p-8">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <p className="text-sm text-white/60 mt-1">Simple workflow. Real accountability.</p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <Step n="1" title="Invite agents" desc="Create users, assign uplines, set roles." />
              <Step n="2" title="Post deals" desc="Agents submit business in seconds." />
              <Step n="3" title="Track production" desc="Dashboards show only what each user should see." />
              <Step n="4" title="Auto reporting" desc="Discord + nightly owner emails deliver daily numbers." />
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-[var(--accent)] hover:opacity-90 transition px-5 py-3 text-sm font-semibold text-center"
                style={{ color: 'var(--accentText)' as any }}
              >
                Go to Login
              </Link>
              <a
                href="mailto:support@mail.yourflowcrm.com?subject=Flow%20Demo%20Request"
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition px-5 py-3 text-sm font-semibold text-center"
              >
                Request Demo
              </a>
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section id="compliance" className="mx-auto max-w-6xl px-6 pb-14">
          <div className="glass rounded-3xl border border-white/10 p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Compliance & Security</h2>
            <p className="text-sm text-white/60 mt-1">
              Built to support structured operations. Use appropriate disclosures and safeguards for your organization.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <MiniInfo title="Access control" desc="Role + downline-based visibility to reduce data leakage." />
              <MiniInfo title="Audit-friendly" desc="Centralized data makes reporting and oversight easier." />
              <MiniInfo title="Policies" desc="Terms + Privacy included; extend with your agency policies as needed." />
            </div>

            <div className="mt-6 text-[12px] text-white/55 leading-relaxed">
              Note: Flow is a productivity and reporting platform. You are responsible for compliance requirements applicable
              to your business (including record retention, disclosures, and data handling policies).
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/10 bg-black/20">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="text-lg font-semibold">Flow</div>
                <div className="text-sm text-white/60 mt-1">A CRM for top agents.</div>
              </div>

              <div>
                <div className="text-sm font-semibold">Product</div>
                <div className="mt-3 space-y-2 text-sm text-white/60">
                  <a href="#features" className="block hover:text-white transition">Features</a>
                  <a href="#how" className="block hover:text-white transition">How it works</a>
                  <Link href="/login" className="block hover:text-white transition">Login</Link>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold">Legal</div>
                <div className="mt-3 space-y-2 text-sm text-white/60">
                  <Link href="/terms" className="block hover:text-white transition">Terms & Conditions</Link>
                  <Link href="/privacy" className="block hover:text-white transition">Privacy Policy</Link>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold">Contact</div>
                <div className="mt-3 space-y-2 text-sm text-white/60">
                  <a className="block hover:text-white transition" href="mailto:support@mail.yourflowcrm.com">
                    support@mail.yourflowcrm.com
                  </a>
                  <div className="text-[11px] text-white/45">
                    Operational notices, reporting, and support.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px] text-white/45">
              <div>© {new Date().getFullYear()} Flow. All rights reserved.</div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400/70" /> Status: Operational
                </span>
                <span className="text-white/30">•</span>
                <span>Built for performance teams.</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

/* ---------- UI bits ---------- */

function StatCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-white/60 mt-1">{sub}</div>
    </div>
  )
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="glass rounded-3xl border border-white/10 p-6">
      <div className="text-base font-semibold">{title}</div>
      <div className="text-sm text-white/60 mt-2 leading-relaxed">{desc}</div>
    </div>
  )
}

function PreviewRow({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-white/60 mt-1">{sub}</div>
    </div>
  )
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-xs font-black">
          {n}
        </div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="text-xs text-white/60 mt-2 leading-relaxed">{desc}</div>
    </div>
  )
}

function MiniInfo({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-white/60 mt-2 leading-relaxed">{desc}</div>
    </div>
  )
}
