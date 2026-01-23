// app/wetransfer-alternative/page.tsx
import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import TrackingCtas from './TrackingCtas'

export const metadata: Metadata = {
  title: 'WeTransfer Alternative for Paid File Sharing | FilePay',
  description:
    'A secure WeTransfer alternative to send large files and get paid. Links expire automatically. No free trials.',
  alternates: { canonical: '/wetransfer-alternative' },
  openGraph: {
    title: 'WeTransfer Alternative for Paid File Sharing | FilePay',
    description:
      'A secure WeTransfer alternative to send large files and get paid. Links expire automatically. No free trials.',
    url: '/wetransfer-alternative',
    siteName: 'FilePay',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WeTransfer Alternative for Paid File Sharing | FilePay',
    description:
      'A secure WeTransfer alternative to send large files and get paid. Links expire automatically. No free trials.',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#070A13',
    color: '#E7EAF2',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  wrap: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '32px 18px 64px',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
    marginTop: 28,
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.10)',
    background:
      'radial-gradient(900px 500px at 20% 0%, rgba(124,92,255,0.25), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: 18,
    alignItems: 'stretch',
  },
  h1: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1.07,
    letterSpacing: -0.8,
  },
  sub: {
    marginTop: 12,
    marginBottom: 0,
    color: '#C9D0E1',
    fontSize: 16,
    lineHeight: 1.65,
    maxWidth: 620,
  },
  ctas: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  micro: { marginTop: 12, fontSize: 13, color: '#C9D0E1', opacity: 0.95 },

  sideCard: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    padding: 16,
    height: '100%',
  },
  sideTitle: { margin: 0, fontWeight: 950, fontSize: 14, letterSpacing: -0.1 },
  bullets: { margin: '10px 0 0', paddingLeft: 18, color: '#C9D0E1', lineHeight: 1.75, fontSize: 13 },

  row: { marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    padding: 16,
  },
  cardTitle: { margin: 0, fontWeight: 950, fontSize: 14, letterSpacing: -0.1 },
  cardText: { margin: '8px 0 0', color: '#C9D0E1', lineHeight: 1.6, fontSize: 13 },

  section: { marginTop: 30 },
  h2: { margin: '0 0 10px', fontSize: 20, letterSpacing: -0.3 },
  how: { display: 'grid', gridTemplateColumns: '1fr', gap: 10 },
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

  faq: {
    marginTop: 10,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  qa: { padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)' },
  q: { margin: 0, fontWeight: 950, letterSpacing: -0.1 },
  a: { margin: '8px 0 0', color: '#C9D0E1', lineHeight: 1.65, fontSize: 14 },

  bottomCta: {
    marginTop: 28,
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

  footer: { marginTop: 28, color: '#C9D0E1', opacity: 0.7, fontSize: 12 },
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
            <Link href="/pricing" style={S.navLink}>
              Pricing
            </Link>
            <Link href="/terms" style={S.navLink}>
              Terms
            </Link>
            <Link href="/privacy" style={S.navLink}>
              Privacy
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section style={S.hero}>
          <div style={S.heroGrid}>
            <div>
              <h1 style={S.h1}>
                A better WeTransfer alternative for <span style={{ color: '#D9D3FF' }}>secure</span> file sharing.
              </h1>
              <p style={S.sub}>
                Upload a file, generate a <b>time-limited</b> download link, share it — and it expires automatically.
                Built as <b>paid-only</b> to reduce abuse and keep the platform reliable.
              </p>

              {/* ✅ Tracked CTAs (Hero) */}
              <div style={S.ctas}>
                <TrackingCtas variant="hero" />
              </div>

              <div style={S.micro}>
                Works for documents, images, videos, and zipped projects. Risky executable formats may be blocked for safety.
              </div>
            </div>

            <aside style={S.sideCard}>
              <p style={S.sideTitle}>Why FilePay</p>
              <ul style={S.bullets}>
                <li>Expiration by default (less risk of old links leaking)</li>
                <li>Simple “upload → link → share” flow</li>
                <li>Designed for client deliveries & professional sharing</li>
                <li>Operational tooling: reporting & admin cleanup</li>
              </ul>
            </aside>
          </div>
        </section>

        {/* Value props */}
        <section style={S.row}>
          <div style={S.card}>
            <p style={S.cardTitle}>Expires automatically</p>
            <p style={S.cardText}>
              Links are temporary by design. Great for client handoffs, private docs, and short-term sharing.
            </p>
          </div>
          <div style={S.card}>
            <p style={S.cardTitle}>Paid-only to reduce abuse</p>
            <p style={S.cardText}>
              Free upload services attract spam, malware, and illegal content. Paid-only keeps things cleaner.
            </p>
          </div>
          <div style={S.card}>
            <p style={S.cardTitle}>Straightforward pricing</p>
            <p style={S.cardText}>
              No confusing limits. Pick an expiry, generate the link, done. Upgrade to Pro to skip per-link checkout.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section style={S.section}>
          <h2 style={S.h2}>How it works</h2>
          <div style={S.how}>
            <div style={S.step}>
              <div style={S.stepNum}>1</div>
              <p style={S.stepText}>
                <b>Upload</b> your file (drag & drop or select).
              </p>
            </div>
            <div style={S.step}>
              <div style={S.stepNum}>2</div>
              <p style={S.stepText}>
                <b>Choose expiry</b> (1, 3, 7, 14, 30 days).
              </p>
            </div>
            <div style={S.step}>
              <div style={S.stepNum}>3</div>
              <p style={S.stepText}>
                <b>Share the link</b>. It expires automatically.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={S.section}>
          <h2 style={S.h2}>FAQ</h2>
          <div style={S.faq}>
            <div style={{ ...S.qa, borderTop: 'none' }}>
              <p style={S.q}>Is FilePay free?</p>
              <p style={S.a}>
                No — paid-only is intentional to reduce abuse (spam, malware, illegal content) and keep reliability high.
              </p>
            </div>
            <div style={S.qa}>
              <p style={S.q}>What happens when a link expires?</p>
              <p style={S.a}>
                The link becomes inaccessible. Expired items are eligible for cleanup in storage and the database.
              </p>
            </div>
            <div style={S.qa}>
              <p style={S.q}>What file types can I upload?</p>
              <p style={S.a}>
                Common docs, images, videos, and zipped projects. Risky executable formats may be blocked.
              </p>
            </div>
            <div style={S.qa}>
              <p style={S.q}>Where are Terms and Privacy?</p>
              <p style={S.a}>
                Here:{' '}
                <Link href="/terms" style={{ color: '#D9D3FF', textDecoration: 'underline' }}>
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="/privacy" style={{ color: '#D9D3FF', textDecoration: 'underline' }}>
                  Privacy
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={S.bottomCta}>
          <div>
            <p style={S.bottomTitle}>Ready to send a secure link?</p>
            <p style={S.bottomText}>Upload a file and generate a time-limited download link in seconds.</p>
          </div>

          {/* ✅ Tracked CTA (Bottom) */}
          <TrackingCtas variant="bottom" />
        </section>

        <footer style={S.footer}>
          <div>© {new Date().getFullYear()} FilePay</div>
          <div style={S.footLinks}>
            <Link href="/pricing" style={S.footLink}>
              Pricing
            </Link>
            <Link href="/terms" style={S.footLink}>
              Terms
            </Link>
            <Link href="/privacy" style={S.footLink}>
              Privacy
            </Link>
          </div>
        </footer>
      </div>

      <style>{`
        @media (max-width: 900px) {
          section[style*="grid-template-columns: 1.2fr"] { grid-template-columns: 1fr !important; }
          section[style*="repeat(3"] { grid-template-columns: 1fr !important; }
          h1 { font-size: 34px !important; }
        }
      `}</style>
    </main>
  )
}