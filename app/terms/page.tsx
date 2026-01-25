// ✅ CREATE THIS FILE: /app/terms/page.tsx
'use client'

import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-white/60">Legal</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">Terms & Conditions</h1>
          </div>
          <Link href="/" className="text-sm text-white/70 hover:text-white transition">
            ← Back
          </Link>
        </div>

        <div className="glass rounded-3xl border border-white/10 p-8 space-y-6">
          <p className="text-sm text-white/70 leading-relaxed">
            These Terms & Conditions govern your use of Flow (YourFlowCRM). By accessing or using the service, you agree to
            these terms.
          </p>

          <Section title="1. Use of Service">
            Flow is provided for business operations, productivity, reporting, and team performance tracking. You agree not
            to misuse the platform, attempt unauthorized access, or interfere with service operations.
          </Section>

          <Section title="2. Account Responsibilities">
            You are responsible for safeguarding login credentials and maintaining appropriate access policies for your
            organization. You are responsible for all activity under your account.
          </Section>

          <Section title="3. Data & Compliance">
            You are responsible for compliance obligations that apply to your business (including data handling policies,
            retention, disclosures, and operational procedures). Flow provides tooling; it does not provide legal advice.
          </Section>

          <Section title="4. Service Availability">
            We aim for reliable uptime but do not guarantee uninterrupted service. Maintenance, outages, and third-party
            dependencies may impact availability.
          </Section>

          <Section title="5. Changes">
            We may update these Terms periodically. Continued use after changes means you accept the updated Terms.
          </Section>

          <div className="text-[11px] text-white/50 pt-2">
            Need support? Email <span className="text-white/70">support@mail.yourflowcrm.com</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm text-white/70 mt-2 leading-relaxed">{children}</div>
    </div>
  )
}
