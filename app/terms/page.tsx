// app/terms/page.tsx
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: '26px 0 10px', fontSize: 18, fontWeight: 900, letterSpacing: -0.2 }}>
      {children}
    </h2>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>{children}</div>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 18,
        padding: 18,
        boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </div>
  )
}

function Callout({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        marginTop: 14,
        borderRadius: 16,
        border: '1px solid rgba(59,130,246,0.24)',
        background: 'rgba(59,130,246,0.10)',
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 950, marginBottom: 6 }}>{title}</div>
      <div style={{ opacity: 0.9, fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul style={{ margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.65, color: 'rgba(255,255,255,0.88)' }}>
      {children}
    </ul>
  )
}

export default function TermsPage() {
  const updated = 'January 2026'

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.logoDot} />
            <div style={styles.brandLabel}>FilePay</div>
            <span style={styles.badge}>Legal</span>
          </div>

          <Link href="/" style={styles.backLink}>
            ← Back to FilePay
          </Link>
        </header>

        <Card>
          <h1 style={styles.h1}>Terms of Service</h1>
          <Muted>
            Last updated: <b style={{ color: 'white' }}>{updated}</b>. These Terms govern your use of FilePay (the “Service”).
            By using the Service, you agree to these Terms.
          </Muted>

          <Callout title="Quick summary (non-binding)">
            You’re responsible for what you upload and share. Don’t upload illegal content, malware, or copyrighted material without permission.
            We can suspend accounts and remove content to keep the platform safe.
          </Callout>

          <SectionTitle>1. The Service</SectionTitle>
          <Muted>
            FilePay lets you upload files and generate time-limited download links. Some links may require a one-time payment to unlock.
            Files are stored using third-party infrastructure providers.
          </Muted>

          <SectionTitle>2. Eligibility</SectionTitle>
          <Muted>
            You must be able to form a legally binding contract and comply with applicable laws in your jurisdiction. If you use FilePay on behalf
            of an organization, you represent that you have authority to bind it.
          </Muted>

          <SectionTitle>3. Acceptable Use</SectionTitle>
          <Muted>When using FilePay, you agree you will not upload, share, or distribute content that:</Muted>
          <List>
            <li>is illegal, harmful, or violates applicable laws (including child sexual abuse material or exploitation)</li>
            <li>contains malware, viruses, ransomware, or other malicious code</li>
            <li>infringes copyrights, trademarks, or other intellectual property rights</li>
            <li>invades privacy, doxxes, or contains sensitive personal information without permission</li>
            <li>is used to facilitate fraud, scams, phishing, or unauthorized access</li>
          </List>

          <Callout title="Enforcement">
            We may remove content, block links, suspend access, or terminate accounts if we believe there is a violation of these Terms or a risk to
            users, the public, or the Service.
          </Callout>

          <SectionTitle>4. Content Responsibility</SectionTitle>
          <Muted>
            You retain ownership of your content, but you are solely responsible for it, including legality, reliability, and appropriate permissions.
            You grant us a limited license to host and process your content solely to provide and secure the Service.
          </Muted>

          <SectionTitle>5. Payments & Refunds</SectionTitle>
          <Muted>
            Payments are processed via third-party payment providers (e.g., Stripe). Fees, pricing, and subscription terms (if applicable) may change.
            Unless required by law, refunds are not guaranteed for one-time link payments. If you believe a charge is fraudulent or incorrect, contact
            us promptly.
          </Muted>

          <SectionTitle>6. Expiration & Deletion</SectionTitle>
          <Muted>
            Download links can expire. Expired links may be automatically marked for cleanup and deleted from storage and/or our database. We do not
            guarantee indefinite retention of uploaded files, especially for expired links.
          </Muted>

          <SectionTitle>7. Security & Abuse Prevention</SectionTitle>
          <Muted>
            We use reasonable measures to protect the Service, but no system is 100% secure. You agree not to attempt to bypass security controls,
            scrape, reverse engineer, or overload the Service. We may rate-limit or block suspicious activity.
          </Muted>

          <SectionTitle>8. Third-Party Services</SectionTitle>
          <Muted>
            The Service relies on third-party providers (hosting, storage, email, analytics, payments). Their availability and terms may affect the
            Service. We are not responsible for third-party outages or changes.
          </Muted>

          <SectionTitle>9. Disclaimers</SectionTitle>
          <Muted>
            The Service is provided “as is” and “as available” without warranties of any kind. We do not warrant that the Service will be uninterrupted,
            error-free, or that uploaded files will always be retained.
          </Muted>

          <SectionTitle>10. Limitation of Liability</SectionTitle>
          <Muted>
            To the fullest extent permitted by law, FilePay will not be liable for indirect, incidental, special, consequential, or punitive damages,
            or any loss of profits, revenue, data, or goodwill. Our total liability for any claim will not exceed the fees you paid to FilePay for the
            Service in the prior 3 months, if any.
          </Muted>

          <SectionTitle>11. Termination</SectionTitle>
          <Muted>
            You may stop using the Service at any time. We may suspend or terminate access if you violate these Terms, if required by law, or to protect
            the Service and users.
          </Muted>

          <SectionTitle>12. Changes to These Terms</SectionTitle>
          <Muted>
            We may update these Terms from time to time. Changes are effective when posted. Continued use of the Service after changes means you accept
            the updated Terms.
          </Muted>

          <SectionTitle>13. Contact</SectionTitle>
          <Muted>
            Questions or reports of abuse can be sent to: <b style={{ color: 'white' }}>{process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@yourdomain.com'}</b>
          </Muted>

          <div style={styles.footerRow}>
            <Link href="/privacy" style={styles.footerLink}>
              Privacy Policy →
            </Link>
          </div>
        </Card>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    padding: 24,
    color: '#fff',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.26), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.22), transparent 55%), #07070a',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
  },
  container: { maxWidth: 900, margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.9))',
    boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
  },
  brandLabel: { fontWeight: 950, letterSpacing: -0.3, opacity: 0.95 },
  badge: {
    fontSize: 12,
    fontWeight: 900,
    padding: '5px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
  },
  backLink: {
    color: 'rgba(255,255,255,0.85)',
    textDecoration: 'none',
    fontWeight: 850,
    fontSize: 13,
    border: '1px solid rgba(255,255,255,0.14)',
    padding: '8px 10px',
    borderRadius: 12,
    background: 'rgba(0,0,0,0.22)',
  },
  h1: { margin: 0, fontSize: 30, fontWeight: 980, letterSpacing: -0.8 },
  footerRow: { marginTop: 18, display: 'flex', justifyContent: 'flex-end' },
  footerLink: { color: 'white', textDecoration: 'none', fontWeight: 900, opacity: 0.9 },
}