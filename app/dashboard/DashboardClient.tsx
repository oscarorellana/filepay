'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type LinkRow = {
  id: string
  code: string
  file_path: string
  created_at: string
  paid: boolean
  paid_at: string | null
  expires_at: string | null
  days: number | null
  // opcional: si luego guardas amount/currency aquí, lo mostramos
  amount_cents?: number | null
  currency?: string | null
}

function useIsMobile(bp = 900) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${bp}px)`)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [bp])

  return isMobile
}

function fileNameFromPath(p: string) {
  const clean = (p ?? '').split('?')[0]
  const parts = clean.split('/')
  return parts[parts.length - 1] || p || 'file'
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatAmount(amountCents?: number | null, currency?: string | null) {
  if (typeof amountCents !== 'number') return null
  const cur = (currency || 'usd').toUpperCase()
  return `${(amountCents / 100).toFixed(2)} ${cur}`
}

function statusForLink(l: LinkRow) {
  if (!l.paid) return { label: 'Unpaid', kind: 'warn' as const }
  if (!l.expires_at) return { label: 'Active', kind: 'ok' as const }
  const exp = new Date(l.expires_at)
  if (Number.isNaN(exp.getTime())) return { label: 'Active', kind: 'ok' as const }
  const now = Date.now()
  if (exp.getTime() <= now) return { label: 'Expired', kind: 'muted' as const }
  return { label: 'Active', kind: 'ok' as const }
}

export default function DashboardClient() {
  const isMobile = useIsMobile(900)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [email, setEmail] = useState<string | null>(null)
  const [links, setLinks] = useState<LinkRow[]>([])

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return process.env.NEXT_PUBLIC_SITE_URL || ''
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || window.location.origin
  }, [])

  async function load() {
    setMsg('')
    setLoading(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      setEmail(u.user?.email ?? null)

      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) {
        setLinks([])
        setMsg('Please sign in to see your dashboard.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/links', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Failed to load links')

      setLinks(Array.isArray(json?.links) ? (json.links as LinkRow[]) : [])
    } catch (e: any) {
      setMsg(e?.message ?? 'Something went wrong')
      setLinks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copy(text: string) {
    try {
      setBusy(true)
      await navigator.clipboard.writeText(text)
      setMsg('Copied ✅')
      window.setTimeout(() => setMsg(''), 1200)
    } catch {
      setMsg('Could not copy (browser blocked it).')
      window.setTimeout(() => setMsg(''), 1800)
    } finally {
      setBusy(false)
    }
  }

  const pageStyle: CSSProperties = { ...styles.page, padding: isMobile ? 14 : 24 }
  const topStyle: CSSProperties = { ...styles.top, flexDirection: isMobile ? 'column' : 'row' }
  const gridStyle: CSSProperties = {
    ...styles.grid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  return (
    <main style={pageStyle}>
      <div style={styles.container}>
        {/* Top bar */}
        <header style={topStyle}>
          <div style={styles.brandRow}>
            <div style={styles.logoDot} />
            <div>
              <h1 style={styles.h1}>Dashboard</h1>
              <p style={styles.p}>
                Your created links, their status, and quick actions.
              </p>
              {email && (
                <div style={styles.metaRow}>
                  <span style={styles.metaPill}>
                    Signed in as <b>{email}</b>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={styles.topRight}>
            <a href="/" style={styles.linkBtn}>
              ← Back to home
            </a>
            <a href="/pricing" style={styles.linkBtn}>
              Pricing
            </a>
            <a href="/billing" style={styles.primaryOutlineBtn}>
              Manage subscription
            </a>
          </div>
        </header>

        {/* Message */}
        {msg && <div style={styles.note}>{msg}</div>}

        {/* Content */}
        {loading ? (
          <div style={gridStyle}>
            {Array.from({ length: isMobile ? 4 : 6 }).map((_, i) => (
              <div key={i} style={styles.skelCard}>
                <div style={styles.skelTop} />
                <div style={styles.skelLine} />
                <div style={{ ...styles.skelLine, width: '65%' }} />
                <div style={{ ...styles.skelLine, width: '45%' }} />
                <div style={styles.skelBtns} />
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyTitle}>No links yet</div>
            <div style={styles.emptyText}>
              Go create your first link — you’ll see it here with status + expiry.
            </div>
            <a href="/" style={styles.primaryBtn}>
              Create a link →
            </a>
          </div>
        ) : (
          <div style={gridStyle}>
            {links.map((l) => {
              const fname = fileNameFromPath(l.file_path)
              const url = `${origin}/dl/${encodeURIComponent(l.code)}`
              const s = statusForLink(l)
              const amount = formatAmount(l.amount_cents ?? null, l.currency ?? null)

              return (
                <article key={l.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.fileRow}>
                        <div style={styles.fileIcon}>📄</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={styles.fileName} title={fname}>
                            {fname}
                          </div>
                          <div style={styles.fileSub}>
                            Code: <span style={styles.mono}>{l.code}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.statusPill,
                        ...(s.kind === 'ok'
                          ? styles.pillOk
                          : s.kind === 'warn'
                            ? styles.pillWarn
                            : styles.pillMuted),
                      }}
                      title={s.label}
                    >
                      {s.label}
                    </span>
                  </div>

                  <div style={styles.kv}>
                    <div style={styles.k}>
                      Paid
                    </div>
                    <div style={styles.v}>
                      {l.paid ? 'Yes' : 'No'}
                      {amount ? <span style={styles.vDim}> · {amount}</span> : null}
                      {typeof l.days === 'number' ? <span style={styles.vDim}> · {l.days} days</span> : null}
                    </div>
                  </div>

                  <div style={styles.kv}>
                    <div style={styles.k}>Purchased</div>
                    <div style={styles.v}>{formatDate(l.paid_at)}</div>
                  </div>

                  <div style={styles.kv}>
                    <div style={styles.k}>Expires</div>
                    <div style={styles.v}>{formatDate(l.expires_at)}</div>
                  </div>

                  <div style={styles.urlBox}>
                    <div style={styles.urlLabel}>Share link</div>
                    <div style={styles.urlMono}>{url}</div>
                  </div>

                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={{ ...styles.btn, opacity: busy ? 0.75 : 1 }}
                      disabled={busy}
                      onClick={() => copy(url)}
                    >
                      Copy
                    </button>
                    <a href={`/dl/${encodeURIComponent(l.code)}`} style={styles.linkAction} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <a href={`/success?session_id=pro_${encodeURIComponent(l.code)}`} style={styles.linkAction}>
                      View status
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <footer style={styles.footer}>
          Tip: next we’ll add “Disable link”, “Expires in X days”, and “Cost + purchase date” (properly).
        </footer>
      </div>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100svh',
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.22), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.18), transparent 55%), #07070a',
    color: 'white',
  },
  container: { maxWidth: 1100, margin: '0 auto' },

  top: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' },
  brandRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  logoDot: {
    width: 12,
    height: 12,
    marginTop: 10,
    borderRadius: 999,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.9))',
  },
  h1: { margin: 0, fontSize: 32, fontWeight: 950, letterSpacing: -0.3, lineHeight: 1.05 },
  p: { margin: '8px 0 0', opacity: 0.78, fontSize: 13, lineHeight: 1.45, maxWidth: 680 },

  metaRow: { marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 },
  metaPill: {
    fontSize: 12,
    fontWeight: 850,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    opacity: 0.95,
  },

  topRight: { display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },

  grid: { display: 'grid', gap: 14, marginTop: 16 },

  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 14,
    display: 'grid',
    gap: 12,
    minWidth: 0,
  },

  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },

  fileRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  fileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    fontSize: 16,
    flex: '0 0 auto',
  },
  fileName: {
    fontWeight: 950,
    fontSize: 14,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 520,
  },
  fileSub: { marginTop: 2, fontSize: 12, opacity: 0.72, lineHeight: 1.35 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },

  statusPill: {
    fontSize: 12,
    fontWeight: 900,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    whiteSpace: 'nowrap',
    height: 'fit-content',
  },
  pillOk: { background: 'rgba(16,185,129,0.16)' },
  pillWarn: { background: 'rgba(245,158,11,0.16)' },
  pillMuted: { background: 'rgba(255,255,255,0.06)' },

  kv: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' },
  k: { fontSize: 12, opacity: 0.68 },
  v: { fontSize: 13, fontWeight: 850, opacity: 0.92 },
  vDim: { fontWeight: 800, opacity: 0.7 },

  urlBox: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    padding: 12,
    display: 'grid',
    gap: 6,
  },
  urlLabel: { fontSize: 12, opacity: 0.7, fontWeight: 850 },
  urlMono: {
    fontSize: 12,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    wordBreak: 'break-all',
    opacity: 0.95,
  },

  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },

  btn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.95)',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
  },

  linkAction: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    textDecoration: 'none',
  },

  linkBtn: {
    display: 'inline-block',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  primaryOutlineBtn: {
    display: 'inline-block',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(124,58,237,0.16)',
    color: 'white',
    fontWeight: 900,
    textDecoration: 'none',
  },

  note: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 12,
    opacity: 0.92,
    whiteSpace: 'pre-wrap',
  },

  empty: {
    marginTop: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.30)',
    padding: 18,
    display: 'grid',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: 950 },
  emptyText: { opacity: 0.78, fontSize: 13, lineHeight: 1.45, maxWidth: 620 },
  primaryBtn: {
    display: 'inline-block',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))',
    color: '#0b0b10',
    fontWeight: 950,
    textDecoration: 'none',
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
    width: 'fit-content',
  },

  // Skeleton
  skelCard: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 14,
    display: 'grid',
    gap: 10,
  },
  skelTop: {
    height: 18,
    width: '70%',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
  },
  skelLine: {
    height: 12,
    width: '85%',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
  },
  skelBtns: {
    height: 38,
    width: '55%',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    marginTop: 6,
  },

  footer: { marginTop: 16, opacity: 0.6, fontSize: 12, textAlign: 'center' },
}