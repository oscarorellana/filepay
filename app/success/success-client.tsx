'use client'

import { useEffect, useMemo, useState } from 'react'
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

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SuccessClient() {
  const sp = useSearchParams()

  const sessionId = useMemo(() => (sp?.get('session_id') ?? '').trim(), [sp])
  const debug = useMemo(() => (sp?.get('debug') ?? '').trim() === '1', [sp])

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [json, setJson] = useState<FinalizeResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const isOkPaid = json?.paid === true
  const isOkPro = json?.pro === true
  const isOk = isOkPaid || isOkPro

  const downloadUrl = useMemo(() => {
    if (!json?.code) return null
    // Always use the actual origin where the app is running
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/dl/${encodeURIComponent(json.code)}`
  }, [json?.code])

  async function finalize() {
    setMsg('')
    setCopied(false)

    if (!sessionId) {
      setMsg('❌ Missing session_id in URL.')
      return
    }

    setBusy(true)
    try {
      const r = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      const j = (await r.json().catch(() => ({}))) as FinalizeResponse
      setJson(j)

      if (!r.ok) throw new Error(j?.error || 'Finalization failed')

      const okPaid = j?.paid === true
      const okPro = j?.pro === true
      if (!okPaid && !okPro) {
        throw new Error('Finalization did not return a paid link or a Pro activation.')
      }

      // ✅ Friendly message
      if (okPro) {
        const ends = formatShortDate(j.current_period_end)
        setMsg(ends ? `✅ Pro activated. Renews ${ends}.` : '✅ Pro activated. You can manage billing anytime.')
      } else {
        setMsg('✅ Payment finalized. Your link is ready.')
      }
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? 'Something went wrong'}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    finalize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      // no auto-close, no desaparecer
    } catch {
      setCopied(false)
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>{isOk ? 'All set ✅' : 'Finalizing…'}</h1>

        {/* Main message */}
        {msg && <div style={styles.msg}>{msg}</div>}

        {/* Paid link info */}
        {isOkPaid && downloadUrl && (
          <div style={styles.linkBox}>
            <div style={styles.label}>Your share link</div>
            <div style={styles.mono}>{downloadUrl}</div>

            <div style={styles.row}>
              <button
                type="button"
                onClick={() => copy(downloadUrl)}
                style={styles.btnPrimary}
                disabled={busy}
              >
                {copied ? 'Copied ✅' : 'Copy link'}
              </button>

              <a href={downloadUrl} style={styles.btnGhost}>
                Open link
              </a>
            </div>

            <div style={styles.hint}>
              Share this link with anyone. It will expire based on the duration you selected.
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={styles.row}>
          <a href="/" style={styles.btnGhost}>
            Back to home
          </a>

          {/* Only show Manage subscription if Pro */}
          {isOkPro && (
            <a href="/billing" style={styles.btnGhost}>
              Manage subscription
            </a>
          )}

          {/* Retry ONLY when NOT ok */}
          {!isOk && (
            <button
              type="button"
              onClick={finalize}
              disabled={busy}
              style={styles.btnPrimary}
            >
              {busy ? 'Working…' : 'Retry finalize'}
            </button>
          )}
        </div>

        {/* Debug only */}
        {debug && json && (
          <details style={styles.details}>
            <summary style={styles.summary}>Debug response</summary>
            <pre style={styles.pre}>{JSON.stringify({ sessionId, ...json }, null, 2)}</pre>
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
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.22), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.18), transparent 55%), #07070a',
    color: 'white',
    display: 'grid',
    placeItems: 'center',
  },
  card: {
    width: 'min(820px, 100%)',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 16,
    display: 'grid',
    gap: 12,
  },
  h1: { margin: 0, fontSize: 24, fontWeight: 950, letterSpacing: -0.2 },
  msg: {
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 13,
    whiteSpace: 'pre-wrap',
  },
  linkBox: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    padding: 12,
    display: 'grid',
    gap: 10,
  },
  label: { opacity: 0.75, fontSize: 12, fontWeight: 800 },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    wordBreak: 'break-all',
    opacity: 0.92,
  },
  row: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  btnPrimary: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.95)',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  },
  btnGhost: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    textDecoration: 'none',
    display: 'inline-block',
  },
  hint: { opacity: 0.65, fontSize: 12, lineHeight: 1.35 },
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
}