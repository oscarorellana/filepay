// app/privacy/page.tsx
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
        border: '1px solid rgba(124,58,237,0.28)',
        background: 'rgba(124,58,237,0.14)',
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

function TableRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 12,
        padding: '10px 0',
        borderTop: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <div style={{ fontWeight: 900, opacity: 0.92 }}>{k}</div>
      <div style={{ opacity: 0.88, lineHeight: 1.55 }}>{v}</div>
    </div>
  )
}

export default function PrivacyPage() {
  const updated = 'January 2026'
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@yourdomain.com'

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
          <h1 style={styles.h1}>Privacy Policy</h1>
          <Muted>
            Last updated: <b style={{ color: 'white' }}>{updated}</b>. This Policy explains what we collect, how we use it,
            and your choices.
          </Muted>

          <Callout title="Plain-English summary (non-binding)">
            We collect the minimum needed to run FilePay (account info, payment status, basic logs). We use reputable third-party providers for
            storage, payments, and email. We don’t sell your personal information.
          </Callout>

          <SectionTitle>1. Information We Collect</SectionTitle>
          <Muted>Depending on how you use FilePay, we may collect:</Muted>
          <List>
            <li><b>Account data:</b> email, user ID (if you sign in), authentication metadata</li>
            <li><b>Upload/link data:</b> file path reference, file size (bytes), link code, expiration time, paid status</li>
            <li><b>Usage/log data:</b> timestamps, IP address (for security/abuse prevention), device/browser basics</li>
            <li><b>Payment data:</b> handled by payment processors (we receive limited status info like “paid”)</li>
          </List>

          <SectionTitle>2. How We Use Information</SectionTitle>
          <List>
            <li>Provide the Service (upload, generate links, deliver downloads)</li>
            <li>Process payments and prevent fraud</li>
            <li>Maintain security, rate-limit abuse, and investigate violations</li>
            <li>Customer support and operational communications (e.g., admin reports)</li>
            <li>Improve the Service (aggregate metrics, debugging)</li>
          </List>

          <SectionTitle>3. Where Your Data Is Stored</SectionTitle>
          <Muted>
            File uploads and metadata are stored with third-party infrastructure providers (e.g., storage/database). Provider regions may vary. We
            choose reputable vendors and configure access controls, but no system is perfect.
          </Muted>

          <SectionTitle>4. Sharing & Disclosure</SectionTitle>
          <Muted>We may share information with:</Muted>
          <List>
            <li><b>Service providers</b> (hosting, storage, email, analytics, payments) to operate FilePay</li>
            <li><b>Legal authorities</b> when required by law, or to respond to valid legal process</li>
            <li><b>Safety enforcement</b> to protect users, the public, and our Service (e.g., abuse/malware incidents)</li>
          </List>

          <Callout title="We don’t sell your personal information">
            We do not sell your personal information. If this ever changes, we’ll update this Policy and provide appropriate controls.
          </Callout>

          <SectionTitle>5. Retention</SectionTitle>
          <Muted>
            We keep data only as long as necessary for the Service, security, legal compliance, and legitimate business purposes. Expired links and
            files may be marked for cleanup and deleted. Some minimal logs may be retained longer for abuse prevention and compliance.
          </Muted>

          <SectionTitle>6. Your Choices</SectionTitle>
          <div style={{ marginTop: 10, borderRadius: 16, border: '1px solid rgba(255,255,255,0.10)', padding: 14 }}>
            <TableRow
              k="Access / correction"
              v="If you have an account, you can contact support to request access or correction of account data."
            />
            <TableRow
              k="Deletion"
              v="You can request deletion of your account data, subject to legal/security retention needs."
            />
            <TableRow
              k="Emails"
              v="Operational emails (e.g., receipts, admin reports) may be required; marketing emails can be opted out if added later."
            />
          </div>

          <SectionTitle>7. Security</SectionTitle>
          <Muted>
            We use reasonable technical and organizational measures to protect data (access controls, secrets management, rate limiting, and monitoring).
            You are responsible for keeping your login links/credentials secure.
          </Muted>

          <SectionTitle>8. International Users</SectionTitle>
          <Muted>
            If you access FilePay from outside Canada, your information may be processed in other jurisdictions where our providers operate. We take
            steps to work with reputable providers and maintain security controls.
          </Muted>

          <SectionTitle>9. Contact</SectionTitle>
          <Muted>
            Questions, requests, or abuse reports: <b style={{ color: 'white' }}>{support}</b>
          </Muted>

          <div style={styles.footerRow}>
            <Link href="/terms" style={styles.footerLink}>
              Terms of Service →
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