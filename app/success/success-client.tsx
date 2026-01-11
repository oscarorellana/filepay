'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type FinalizeResponse = {
  ok?: boolean
  paid?: boolean
  pro?: boolean
  code?: string
  stripe_subscription_id?: string | null
  stripe_customer_id?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  error?: string
}

function buildShareUrl(code: string) {
  // Use current origin (works on Vercel + localhost)
  return `${window.location.origin}/dl/${encodeURIComponent(code)}`
}

export default function SuccessClient() {
  const sp = useSearchParams()

  // Important: searchParams can be "not ready" in first render sometimes
  const sessionId = useMemo(() => (sp?.get('session_id') ?? '').trim(), [sp])

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>('Preparing…')
  const [json, setJson] = useState<FinalizeResponse | null>(null)

  const [shareUrl, setShareUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Avoid double-finalize (React strict mode, re-renders, etc.)
  const finalizedFor = useRef<string>('')

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // fallback: select prompt
      window.prompt('Copy this link:', text)
    }
  }

  async function finalize(sid: string) {
    setMsg('')
    setJson(null)
    setShareUrl('')
    setCopied(false)

    setBusy(true)
    try {
      const r = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid }),
      })

      const j = (await r.json().catch(() => ({}))) as FinalizeResponse
      setJson(j)

      if (!r.ok) throw new Error(j?.error || 'Finalization failed')

      const okPaid = j?.paid === true
      const okPro = j?.pro === true

      if (!okPaid && !okPro) {
        throw new Error('Finalization did not return a paid link or a Pro activation.')
      }

      if (okPaid) {
        const code = (j?.code ?? '').trim()
        if (!code) throw new Error('Finalized payment but missing code.')

        const url = buildShareUrl(code)
        setShareUrl(url)

        setMsg('Payment finalized ✅ Your link is ready.')

        // Optional: auto-redirect after a few seconds (comment out if you prefer no redirect)
        setTimeout(() => {
          window.location.href = url
        }, 2500)

        return
      }

      // Pro success
      setMsg('Pro activated ✅ You can manage billing anytime.')
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? 'Something went wrong'}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // Don’t show an error if sessionId isn't ready yet — just wait.
    if (!sessionId) {
      setMsg('Preparing…')
      return
    }

    // Guard: finalize only once per sessionId
    if (finalizedFor.current === sessionId) return
    finalizedFor.current = sessionId

    finalize(sessionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Payment successful ✅</h1>

        <div style={styles.block}>
          <div style={styles.label}>Session</div>
          <div style={styles.mono2}>{sessionId || '(waiting...)'}</div>
        </div>

        {msg && <div style={styles.msg}>{msg}</div>}

        {/* ✅ Share link for paid links */}
        {shareUrl && (
          <div style={styles.shareBox}>
            <div style={styles.shareTitle}>Share this download link</div>

            <div style={styles.shareRow}>
              <input value={shareUrl} readOnly style={styles.shareInput} />
              <button
                type="button"
                onClick={() => copy(shareUrl)}
                style={{ ...styles.btn, whiteSpace: 'nowrap' }}
                disabled={busy}
              >
                {copied ? 'Copied ✅' : 'Copy'}
              </button>
            </div>

            <div style={styles.shareActions}>
              <a href={shareUrl} style={styles.linkBtn}>
                Open download page
              </a>
              <a href="/" style={styles.linkBtn}>
                Back to home
              </a>
            </div>

            <div style={styles.hint}>
              Redirecting automatically in a moment… (or use the buttons above)
            </div>
          </div>
        )}

        {/* Buttons for pro / generic */}
        {!shareUrl && (
          <div style={styles.row}>
            <button
              type="button"
              onClick={() => sessionId && finalize(sessionId)}
              disabled={busy || !sessionId}
              style={{ ...styles.btn, opacity: busy ? 0.7 : 1 }}
            >
              {busy ? 'Working…' : 'Retry finalize'}
            </button>

            <a href="/" style={styles.linkBtn}>
              Back to home
            </a>

            <a href="/billing" style={styles.linkBtn}>
              Manage subscription
            </a>
          </div>
        )}

        {json && (
          <details style={styles.details}>
            <summary style={styles.summary}>Show response</summary>
            <pre style={styles.pre}>{JSON.stringify(json, null, 2)}</pre>
          </details>
        )}
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    padding: 18,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.22), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.18), transparent 55%), #07070a',
    color: 'white',
    display: 'grid',
    placeItems: 'center',
  },
  card: {
    width: 'min(900px, 100%)',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 16,
    display: 'grid',
    gap: 12,
  },
  h1: { margin: 0, fontSize: 24, fontWeight: 950, letterSpacing: -0.2 },
  block: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    padding: 12,
    display: 'grid',
    gap: 6,
  },
  label: { opacity: 0.75, fontSize: 12 },
  mono2: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, wordBreak: 'break-all' },
  msg: {
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 13,
    whiteSpace: 'pre-wrap',
  },
  row: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  btn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.95)',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
  },
  linkBtn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    textDecoration: 'none',
    display: 'inline-block',
  },
  shareBox: {
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    padding: 14,
    display: 'grid',
    gap: 10,
  },
  shareTitle: { fontWeight: 950, fontSize: 13 },
  shareRow: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' },
  shareInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(0,0,0,0.35)',
    color: 'white',
    outline: 'none',
    fontSize: 12,
  },
  shareActions: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  details: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    padding: 12,
  },
  summary: { cursor: 'pointer', fontWeight: 900, fontSize: 12, opacity: 0.9 },
  pre: {
    margin: '10px 0 0',
    padding: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 11,
    overflowX: 'auto',
  },
  hint: { opacity: 0.7, fontSize: 12, lineHeight: 1.35 },
}