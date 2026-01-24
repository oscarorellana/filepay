// app/paid-file-sharing/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Paid File Sharing for Freelancers & Agencies | FilePay',
  description:
    'Charge clients for file downloads with expiring links. A paid-only file sharing tool built for freelancers and agencies.',
  alternates: { canonical: '/paid-file-sharing' },
  openGraph: {
    title: 'Paid File Sharing for Freelancers & Agencies | FilePay',
    description:
      'Charge clients for file downloads with expiring links. Paid-only to reduce abuse and keep reliability high.',
    url: '/paid-file-sharing',
    siteName: 'FilePay',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paid File Sharing for Freelancers & Agencies | FilePay',
    description:
      'Charge clients for file downloads with expiring links. Paid-only to reduce abuse and keep reliability high.',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#07070a',
    color: '#E7EAF2',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  wrap: { maxWidth: 1120, margin: '0 auto', padding: '32px 18px 72px' },

  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  brand: {
    display: 'inline-flex',
    gap: 10,
    alignItems: 'center',
    textDecoration: 'none',
    color: '#E7EAF2',
    fontWeight: 900,
    letterSpacing: -0.2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: '#7C5CFF',
    boxShadow: '0 0 0 3px rgba(124,92,255,0.18)',
  },
  navLinks: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  navLink: {
    color: '#C9D0E1',
    textDecoration: 'none',
    fontWeight: 800,
    fontSize: 13,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
  },

  hero: {
    marginTop: 22,
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.10)',
    background:
      'radial-gradient(900px 500px at 20% 0%, rgba(124,92,255,0.24), transparent 60%), radial-gradient(800px 420px at 90% 10%, rgba(59,130,246,0.18), transparent 55%), rgba(255,255,255,0.03)',
    padding: 22,
    overflow: 'hidden',
  },
  heroGrid: { display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 14, alignItems: 'stretch' },

  h1: { margin: 0, fontSize: 42, lineHeight: 1.08, letterSpacing: -0.8 },
  sub: { marginTop: 12, marginBottom: 0, color: '#C9D0E1', fontSize: 16, lineHeight: 1.65, maxWidth: 660 },

  pills: { marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' },
  pill: {
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.22)',
    fontWeight: 850,
    fontSize: 12,
    color: '#E7EAF2',
  },

  ctas: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  primary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 14,
    background: '#7C5CFF',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#070A13',
    fontWeight: 950,
    textDecoration: 'none',
  },
  secondary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 14px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#E7EAF2',
    fontWeight: 900,
    textDecoration: 'none',
  },
  sideCard: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.18)',
    padding: 16,
    height: '100%',
  },
  sideTitle: { margin: 0, fontWeight: 950, fontSize: 14, letterSpacing: -0.1 },
  bullets: { margin: '10px 0 0', paddingLeft: 18, color: '#C9D0E1', lineHeight: 1.75, fontSize: 13 },

  row: { marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    padding: 16,
  },
  cardTitle: { margin: 0, fontWeight: 950, fontSize: 14, letterSpacing: -0.1 },
  cardText: { margin: '8px 0 0', color: '#C9D0E1', lineHeight: 1.6, fontSize: 13 },

  section: { marginTop: 28 },
  h2: { margin: '0 0 10px', fontSize: 20, letterSpacing: -0.3 },
  how: { display: 'grid', gap: 10 },
  step: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 10,
    background: 'rgba(124,92,255,0.18)',
    border: '1px solid rgba(124,92,255,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 950,
    color: '#D9D3FF',
    flex: '0 0 auto',
  },
  stepText: { margin: 0, color: '#C9D0E1', lineHeight: 1.6, fontSize: 14 },

  bottomCta: {
    marginTop: 26,
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.10)',
    background:
      'radial-gradient(900px 500px at 80% 0%, rgba(124,92,255,0.22), transparent 60%), rgba(255,255,255,0.03)',
    padding: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  bottomTitle: { margin: 0, fontWeight: 950, letterSpacing: -0.2, fontSize: 16 },
  bottomText: { margin: 0, color: '#C9D0E1', fontSize: 13 },

  footer: { marginTop: 28, color: '#C9D0E1', opacity: 0.75, fontSize: 12 },
  footLinks: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 },
  footLink: { color: '#C9D0E1', textDecoration: 'underline' },
}

export default function Page() {
  return (
    <main style={S.page}>
      <div style={S.wrap}>
        {/* Nav */}
        <header style={S.nav}>
          <Link href="/" style={S.brand}>
            <span style={S.dot} />
            FilePay
          </Link>

          <nav style={S.navLinks}>
            <Link href="/wetransfer-alternative" style={S.navLink}>WeTransfer alternative</Link>
            <Link href="/expiring-download-links" style={S.navLink}>Expiring links</Link>
            <Link href="/pricing" style={S.navLink}>Pricing</Link>
            <Link href="/terms" style={S.navLink}>Terms</Link>
            <Link href="/privacy" style={S.navLink}>Privacy</Link>
          </nav>
        </header>

        {/* Hero */}
        <section style={S.hero}>
          <div style={S.heroGrid}>
            <div>
              <h1 style={S.h1}>Paid file sharing for freelancers & agencies.</h1>
              <p style={S.sub}>
                Deliver work to clients using <b>paid</b>, <b>time-limited</b> download links. Built to reduce abuse and keep deliveries clean.
              </p>

              <div style={S.pills}>
                <span style={S.pill}>✅ Pay once, share link</span>
                <span style={S.pill}>⏳ Auto-expiring</span>
                <span style={S.pill}>🧾 Great for client deliveries</span>
              </div>

              <div style={S.ctas}>
                <Link href="/" style={S.primary}>Create a paid link →</Link>
                <Link href="/pricing" style={S.secondary}>View pricing</Link>
              </div>
            </div>

            <aside style={S.sideCard}>
              <p style={S.sideTitle}>Best for</p>
              <ul style={S.bullets}>
                <li>Video editors shipping exports</li>
                <li>Designers delivering final assets</li>
                <li>Agencies handing off client work</li>
                <li>Consultants sharing private docs</li>
              </ul>
            </aside>
          </div>
        </section>

        {/* Value props */}
        <section style={S.row}>
          <div style={S.card}>
            <p style={S.cardTitle}>Paid-only (less abuse)</p>
            <p style={S.cardText}>Free upload tools attract spam, malware and illegal content. Paid-only keeps things cleaner.</p>
          </div>
          <div style={S.card}>
            <p style={S.cardTitle}>Time-limited links</p>
            <p style={S.cardText}>Pick 1–30 days. The link stops working automatically after expiry.</p>
          </div>
          <div style={S.card}>
            <p style={S.cardTitle}>Simple client delivery</p>
            <p style={S.cardText}>Upload → choose expiry → generate link. Recipient doesn’t need an account.</p>
          </div>
        </section>

        {/* How it works */}
        <section style={S.section}>
          <h2 style={S.h2}>How it works</h2>
          <div style={S.how}>
            <div style={S.step}>
              <div style={S.stepNum}>1</div>
              <p style={S.stepText}><b>Upload</b> your file.</p>
            </div>
            <div style={S.step}>
              <div style={S.stepNum}>2</div>
              <p style={S.stepText}><b>Choose expiry</b> (1, 3, 7, 14, 30 days).</p>
            </div>
            <div style={S.step}>
              <div style={S.stepNum}>3</div>
              <p style={S.stepText}><b>Share</b> the paid link with your client.</p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={S.bottomCta}>
          <div>
            <p style={S.bottomTitle}>Ready to deliver your files?</p>
            <p style={S.bottomText}>Create a paid link in seconds. No free trials.</p>
          </div>
          <Link href="/" style={S.primary}>Create a link →</Link>
        </section>

        <footer style={S.footer}>
          <div>© {new Date().getFullYear()} FilePay</div>
          <div style={S.footLinks}>
            <Link href="/wetransfer-alternative" style={S.footLink}>WeTransfer alternative</Link>
            <Link href="/expiring-download-links" style={S.footLink}>Expiring links</Link>
            <Link href="/pricing" style={S.footLink}>Pricing</Link>
            <Link href="/terms" style={S.footLink}>Terms</Link>
            <Link href="/privacy" style={S.footLink}>Privacy</Link>
          </div>
        </footer>
      </div>

      <style>{`
        @media (max-width: 900px) {
          section[style*="grid-template-columns: 1.15fr"] { grid-template-columns: 1fr !important; }
          section[style*="repeat(3"] { grid-template-columns: 1fr !important; }
          h1 { font-size: 34px !important; }
        }
      `}</style>
    </main>
  )
}