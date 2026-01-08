'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

type MarkPaidResponse =
  | { paid: true; code: string; paid_links_30d?: number }
  | { pro: true; user_id: string; status?: string }
  | { error: string }

export default function SuccessPage() {
  const [sessionId, setSessionId] = useState<string>('')

  // Read session_id from URL without Next's searchParams typing issues
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const sid = (sp.get('session_id') ?? '').trim()
      setSessionId(sid)
    } catch {
      setSessionId('')
    }
  }, [])

  return <SuccessInner sessionId={sessionId} />
}

function SuccessInner({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<MarkPaidResponse | null>(null)

  const isProResult = !!(res && 'pro' in res && res.pro === true)
  const isPaidLinkResult = !!(res && 'paid' in res && res.paid === true)

  const finalize = useCallback(async () => {
    if (!sessionId) {
      setRes({ error: 'Missing session_id in URL.' })
      return
    }

    setBusy(true)
    setRes(null)

    try {
      const r = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      const json = (await r.json().catch(() => ({}))) as any
      if (!r.ok) throw new Error(json?.error || 'Finalize failed')

      // Paid link result
      if (json?.paid === true && typeof json?.code === 'string') {
        setRes({ paid: true, code: json.code, paid_links_30d: json.paid_links_30d })
        return
      }

      // Pro subscription result
      if (json?.pro === true && typeof json?.user_id === 'string') {
        setRes({ pro: true, user_id: json.user_id, status: json.status ?? 'active' })
        return
      }

      throw new Error('Finalization did not return a paid link or a Pro activation.')
    } catch (e: any) {
      setRes({ error: e?.message ?? 'Something went wrong' })
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) finalize()
  }, [sessionId, finalize])

  const title = useMemo(() => {
    if (isPaidLinkResult) return 'Payment successful ✅'
    if (isProResult) return 'Pro activated ✅'
    return 'Payment successful ✅'
  }, [isPaidLinkResult, isProResult])

  const subtitle = useMemo(() => {
    if (busy) return 'Finalizing your purchase…'
    if (isPaidLinkResult) return 'Your link is ready.'
    if (isProResult) return 'Your subscription is active.'
    return 'Finalizing…'
  }, [busy, isPaidLinkResult, isProResult])

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.dot} />
            <div>
              <h1 style={styles.h1}>{title}</h1>
              <p style={styles.p}>{subtitle}</p>
            </div>
          </div>

          <div style={styles.body}>
            <div style={styles.kv}>
              <div style={styles.k}>Session ID</div>
              <div style={styles.v}>
                <code style={styles.code}>{sessionId || '(missing)'}</code>
              </div>
            </div>

            {busy && (
              <div style={styles.notice}>
                <span style={styles.noticeDot} />
                <div>
                  <div style={styles.noticeTitle}>Working…</div>
                  <div style={styles.noticeText}>Please wait a moment.</div>
                </div>
              </div>
            )}

            {!busy && isPaidLinkResult && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={styles.successBox}>
                  <div style={styles.successTitle}>Your download is unlocked.</div>
                  <div style={styles.successText}>
                    Code: <b>{(res as any).code}</b>
                  </div>
                </div>

                <div style={styles.row}>
                  <a style={styles.primaryBtn} href={`/dl/${(res as any).code}`}>
                    Go to download page
                  </a>
                  <a style={styles.secondaryBtn} href="/">
                    Back to home
                  </a>
                </div>
              </div>
            )}

            {!busy && isProResult && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={styles.successBoxAlt}>
                  <div style={styles.successTitle}>Pro is active 🎉</div>
                  <div style={styles.successText}>
                    You can now create links without paying per link.
                  </div>
                </div>

                <div style={styles.row}>
                  <a style={styles.primaryBtn} href="/">
                    Back to home
                  </a>
                  <a style={styles.secondaryBtn} href="/pricing">
                    View pricing
                  </a>
                </div>
              </div>
            )}

            {!busy && res && 'error' in res && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={styles.errorBox}>
                  <div style={styles.errorTitle}>Something went wrong</div>
                  <div style={styles.errorText}>We couldn’t finalize the purchase.</div>
                  <div style={{ marginTop: 10 }}>
                    <b>❌ {res.error}</b>
                  </div>
                </div>

                <div style={styles.row}>
                  <button style={styles.primaryBtn} onClick={finalize}>
                    Retry finalize
                  </button>
                  <a style={styles.secondaryBtn} href="/">
                    Back to home
                  </a>
                </div>

                <div style={styles.tip}>
                  If you already paid, wait a few seconds and retry. (In production we’ll use webhooks to avoid this.)
                </div>
              </div>
            )}

            {!busy && !res && !sessionId && (
              <div style={styles.errorBox}>
                <div style={styles.errorTitle}>Missing session_id</div>
                <div style={styles.errorText}>
                  Stripe should redirect here with <code style={styles.code}>?session_id=...</code>
                </div>
                <div style={{ marginTop: 12 }}>
                  <a style={styles.secondaryBtn} href="/">
                    Back to home
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer style={styles.footer}>Local MVP · Success supports paid links + Pro subscriptions</footer>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: 24,
    color: '#fff',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.26), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.22), transparent 55%), #07070a',
  },
  container: { maxWidth: 860, margin: '0 auto' },
  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.9))',
    boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
  },
  h1: { margin: 0, fontSize: 26, fontWeight: 950, letterSpacing: -0.2 },
  p: { margin: '6px 0 0', opacity: 0.8, lineHeight: 1.35 },
  body: { padding: 16, display: 'grid', gap: 14 },

  kv: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'center' },
  k: { opacity: 0.7, fontSize: 12, fontWeight: 800 },
  v: { fontSize: 12 },

  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    padding: '2px 6px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
  },

  notice: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
  },
  noticeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: 'rgba(59,130,246,0.9)',
    boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
  },
  noticeTitle: { fontWeight: 900 },
  noticeText: { opacity: 0.8, fontSize: 13, marginTop: 2 },

  successBox: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(16,185,129,0.25)',
    background: 'rgba(16,185,129,0.10)',
  },
  successBoxAlt: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(59,130,246,0.25)',
    background: 'rgba(59,130,246,0.10)',
  },
  successTitle: { fontWeight: 950, fontSize: 14 },
  successText: { marginTop: 6, opacity: 0.85, fontSize: 13, lineHeight: 1.35 },

  errorBox: {
    padding: 14,
    borderRadius: 14,
    border: '1px solid rgba(244,63,94,0.28)',
    background: 'rgba(244,63,94,0.10)',
  },
  errorTitle: { fontWeight: 950, fontSize: 14 },
  errorText: { marginTop: 6, opacity: 0.9, fontSize: 13, lineHeight: 1.35 },

  row: { display: 'flex', gap: 10, flexWrap: 'wrap' },

  primaryBtn: {
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
    textDecoration: 'none',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  },
  secondaryBtn: {
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    cursor: 'pointer',
    textDecoration: 'none',
  },

  tip: {
    opacity: 0.7,
    fontSize: 12,
    lineHeight: 1.35,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.18)',
  },

  footer: { marginTop: 14, opacity: 0.6, fontSize: 12 },
}