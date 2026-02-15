// app/paid-file-sharing/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Paid File Sharing Links That Expire | FilePay',
  description:
    'Create paid, time-limited download links for client deliverables. Simple checkout, no recipient account, links expire automatically.',
  alternates: { canonical: '/paid-file-sharing' },
  openGraph: {
    title: 'Paid File Sharing Links That Expire | FilePay',
    description:
      'Create paid, time-limited download links for client deliverables. Simple checkout, no recipient account, links expire automatically.',
    url: '/paid-file-sharing',
    siteName: 'FilePay',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paid File Sharing Links That Expire | FilePay',
    description:
      'Create paid, time-limited download links for client deliverables. Simple checkout, no recipient account, links expire automatically.',
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
  wrap: { maxWidth: 1120, margin: '0 auto', padding: '28px 18px 72px' },

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
    fontWeight: 950,
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
    fontWeight: 850,
    fontSize: 13,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
  },

  hero: {
    marginTop: 18,
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.10)',
    background:
      'radial-gradient(900px 520px at 20% 0%, rgba(124,92,255,0.28), transparent 60%), radial-gradient(800px 460px at 90% 10%, rgba(59,130,246,0.20), transparent 55%), rgba(255,255,255,0.03)',
    padding: 22,
    overflow: 'hidden',
  },
  heroGrid: { display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 14, alignItems: 'stretch' },

  h1: { margin: 0, fontSize: 44, lineHeight: 1.06, letterSpacing: -0.9 },
  sub: { marginTop: 10, marginBottom: 0, color: '#C9D0E1', fontSize: 16, lineHeight: 1.65, maxWidth: 720 },

  badges: { marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' },
  badge: {
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.22)',
    fontWeight: 850,
    fontSize: 12,
    color: '#E7EAF2',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
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

  // Visual mock
  mock: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.18)',
    padding: 14,
    height: '100%',
    display: 'grid',
    gap: 10,
  },
  mockTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  mockPill: {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 850,
    color: '#E7EAF2',
  },
  mockCard: {
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    padding: 12,
    display: 'grid',
    gap: 10,
  },
  mockRow: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  mockBtn: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    padding: '10px 12px',
    fontWeight: 900,
    fontSize: 12,
    color: '#E7EAF2',
  },
  mockBtnPrimary: {
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(124,92,255,0.92)',
    padding: '10px 12px',
    fontWeight: 950,
    fontSize: 12,
    color: '#0b0b10',
  },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, opacity: 0.9 },

  section: { marginTop: 22 },
  h2: { margin: '0 0 10px', fontSize: 20, letterSpacing: -0.3 },
  small: { margin: 0, color: '#C9D0E1', lineHeight: 1.7, fontSize: 14, maxWidth: 920 },

  steps: { marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    padding: 16,
  },
  cardTitle: { margin: 0, fontWeight: 950, fontSize: 14, letterSpacing: -0.1, display: 'flex', gap: 10, alignItems: 'center' },
  cardText: { margin: '8px 0 0', color: '#C9D0E1', lineHeight: 1.6, fontSize: 13 },

  useGrid: { marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  chip: {
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.16)',
    padding: 14,
    display: 'grid',
    gap: 6,
  },
  chipTitle: { margin: 0, fontWeight: 950, fontSize: 13 },
  chipText: { margin: 0, color: '#C9D0E1', fontSize: 12, lineHeight: 1.55 },

  split: { marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  note: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    padding: 16,
  },
  list: { margin: '10px 0 0', paddingLeft: 18, color: '#C9D0E1', lineHeight: 1.75, fontSize: 13 },

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
    marginTop: 22,
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

  footer: { marginTop: 26, color: '#C9D0E1', opacity: 0.75, fontSize: 12 },
  footLinks: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 },
  footLink: { color: '#C9D0E1', textDecoration: 'underline' },
}

function Icon({ name }: { name: 'pay' | 'clock' | 'share' | 'lock' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' as const, xmlns: 'http://www.w3.org/2000/svg' }
  const stroke = 'rgba(231,234,242,0.92)'
  const sw = 2

  if (name === 'pay')
    return (
      <svg {...common}>
        <path d="M7 7h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z" stroke={stroke} strokeWidth={sw} />
        <path d="M16 11h2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M4 11h10" stroke={stroke} strokeWidth={sw} strokeLinecap="round" opacity="0.75" />
      </svg>
    )

  if (name === 'clock')
    return (
      <svg {...common}>
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke={stroke} strokeWidth={sw} />
        <path d="M12 6v6l4 2" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )

  if (name === 'share')
    return (
      <svg {...common}>
        <path d="M16 8a3 3 0 1 0-2.83-4" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M8 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" stroke={stroke} strokeWidth={sw} />
        <path d="M19 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" stroke={stroke} strokeWidth={sw} />
        <path d="M10.6 15.2 16.4 12" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        <path d="M10.6 18.8 16.4 20" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    )

  return (
    <svg {...common}>
      <path
        d="M12 22s8-3 8-10V7l-8-3-8 3v5c0 7 8 10 8 10Z"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      <path d="M9.5 12l1.8 1.8L15.8 9.3" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
            <Link href="/wetransfer-alternative" style={S.navLink}>
              WeTransfer alternative
            </Link>
            <Link href="/expiring-download-links" style={S.navLink}>
              Expiring links
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
              <h1 style={S.h1}>Paid download links that expire.</h1>
              <p style={S.sub}>
                Stop sending deliverables first and chasing invoices later. Create a link your client unlocks with payment —{' '}
                then it expires automatically.
              </p>

              <div style={S.badges}>
                <span style={S.badge}>
                  <Icon name="pay" /> Pay-first delivery
                </span>
                <span style={S.badge}>
                  <Icon name="clock" /> 1–30 day expiry
                </span>
                <span style={S.badge}>
                  <Icon name="share" /> No client account
                </span>
                <span style={S.badge}>
                  <Icon name="lock" /> Safer by design
                </span>
              </div>

              <div style={S.ctas}>
                <Link href="/" style={S.primary}>
                  Create a paid link →
                </Link>
                <Link href="/pricing" style={S.secondary}>
                  View pricing
                </Link>
              </div>

              <p style={{ ...S.small, marginTop: 12, fontSize: 12, opacity: 0.85 }}>
                Payments handled by Stripe. No credit cards stored by FilePay.
              </p>
            </div>

            {/* Visual mock */}
            <aside style={S.mock} aria-label="FilePay flow preview">
              <div style={S.mockTop}>
                <span style={S.mockPill}>Preview</span>
                <span style={{ ...S.mockPill, opacity: 0.9 }}>Expires in 7 days</span>
              </div>

              <div style={S.mockCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>Deliverable.zip</div>
                  <div style={{ ...S.mockPill, fontSize: 11 }}>Paid</div>
                </div>
                <div style={{ ...S.mono, opacity: 0.92 }}>filepay.vercel.app/dl/AB12CD34</div>
                <div style={S.mockRow}>
                  <span style={S.mockBtnPrimary}>Copy link</span>
                  <span style={S.mockBtn}>Open link</span>
                  <span style={S.mockBtn}>Send to client</span>
                </div>
              </div>

              <div style={S.mockCard}>
                <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>How it feels for clients</div>
                <ul style={{ ...S.list, marginTop: 8 }}>
                  <li>Open link</li>
                  <li>Pay once</li>
                  <li>Download instantly</li>
                </ul>
              </div>
            </aside>
          </div>
        </section>

        {/* Steps */}
        <section style={S.section}>
          <h2 style={S.h2}>How it works</h2>
          <p style={S.small}>A clean delivery flow built for freelancers and agencies.</p>

          <div style={S.steps}>
            <div style={S.card}>
              <p style={S.cardTitle}>
                <Icon name="share" /> 1) Upload
              </p>
              <p style={S.cardText}>Upload your deliverable (video export, design package, ZIP, doc).</p>
            </div>
            <div style={S.card}>
              <p style={S.cardTitle}>
                <Icon name="clock" /> 2) Choose expiry
              </p>
              <p style={S.cardText}>Pick 1–30 days. Link stops working automatically after expiry.</p>
            </div>
            <div style={S.card}>
              <p style={S.cardTitle}>
                <Icon name="pay" /> 3) Share link
              </p>
              <p style={S.cardText}>Client pays → downloads. No account needed. No awkward follow-ups.</p>
            </div>
          </div>
        </section>

        {/* Best for */}
        <section style={S.section}>
          <h2 style={S.h2}>Best for</h2>
          <div style={S.useGrid}>
            <div style={S.chip}>
              <p style={S.chipTitle}>Video editors</p>
              <p style={S.chipText}>Final renders & exports</p>
            </div>
            <div style={S.chip}>
              <p style={S.chipTitle}>Designers</p>
              <p style={S.chipText}>Brand packages & assets</p>
            </div>
            <div style={S.chip}>
              <p style={S.chipTitle}>Agencies</p>
              <p style={S.chipText}>Client handoff bundles</p>
            </div>
            <div style={S.chip}>
              <p style={S.chipTitle}>Consultants</p>
              <p style={S.chipText}>Private docs & reports</p>
            </div>
            <div style={S.chip}>
              <p style={S.chipTitle}>Freelancers</p>
              <p style={S.chipText}>Project archives (ZIP)</p>
            </div>
            <div style={S.chip}>
              <p style={S.chipTitle}>IT / contractors</p>
              <p style={S.chipText}>Non-executable packages</p>
            </div>
          </div>
        </section>

        {/* Security / Trust */}
        <section style={S.section}>
          <h2 style={S.h2}>Security (honest version)</h2>

          <div style={S.split}>
            <div style={S.note}>
              <p style={{ margin: 0, fontWeight: 950, letterSpacing: -0.1 }}>Good for client deliverables</p>
              <ul style={S.list}>
                <li>HTTPS + Stripe checkout (FilePay doesn’t store card details)</li>
                <li>Paid gate reduces drive-by abuse vs free upload tools</li>
                <li>Links expire automatically (1–30 days)</li>
              </ul>
            </div>

            <div style={S.note}>
              <p style={{ margin: 0, fontWeight: 950, letterSpacing: -0.1 }}>Not “magic” security</p>
              <ul style={S.list}>
                <li>If someone shares an active link, others may access it</li>
                <li>No DRM — once downloaded, it’s theirs</li>
                <li>For ultra-sensitive secrets, use end-to-end encrypted solutions</li>
              </ul>

              <p style={{ ...S.small, marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                “Safer by design” means fewer abuse vectors — not absolute protection.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={S.section}>
          <h2 style={S.h2}>FAQ</h2>
          <div style={S.faq}>
            <div style={{ ...S.qa, borderTop: 'none' }}>
              <p style={S.q}>Do clients need an account?</p>
              <p style={S.a}>No. They open the link, pay once, and download.</p>
            </div>
            <div style={S.qa}>
              <p style={S.q}>What happens when the link expires?</p>
              <p style={S.a}>It stops working automatically after the selected duration.</p>
            </div>
            <div style={S.qa}>
              <p style={S.q}>What files can I upload?</p>
              <p style={S.a}>
                Common docs, images, videos, and ZIP bundles. Risky executable formats may be blocked for safety.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={S.bottomCta}>
          <div>
            <p style={S.bottomTitle}>Ready to deliver your next file?</p>
            <p style={S.bottomText}>Create a paid, expiring link in seconds.</p>
          </div>
          <Link href="/" style={S.primary}>
            Create a paid link →
          </Link>
        </section>

        <footer style={S.footer}>
          <div>© {new Date().getFullYear()} FilePay</div>
          <div style={S.footLinks}>
            <Link href="/pricing" style={S.footLink}>
              Pricing
            </Link>
            <Link href="/wetransfer-alternative" style={S.footLink}>
              WeTransfer alternative
            </Link>
            <Link href="/expiring-download-links" style={S.footLink}>
              Expiring links
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
        @media (max-width: 980px) {
          section[style*="grid-template-columns: 1.05fr"] { grid-template-columns: 1fr !important; }
          section[style*="repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
          h1 { font-size: 36px !important; }
        }
      `}</style>
    </main>
  )
}