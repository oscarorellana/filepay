'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type FinalizeResult = {
  ok?: boolean
  paid?: boolean
  code?: string
  pro?: boolean
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  error?: string
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SuccessPage() {
  const search = useSearchParams()
  const sessionId = (search?.get('session_id') ?? '').trim()

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'working' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState<string>('')
  const [result, setResult] = useState<FinalizeResult | null>(null)

  const isPaid = useMemo(() => result?.paid === true && typeof result?.code === 'string', [result])
  const isPro = useMemo(() => result?.pro === true, [result])

  async function finalize() {
    setMsg('')
    setResult(null)

    if (!sessionId) {
      setStatus('err')
      setMsg('Missing session_id in URL.')
      return
    }

    setBusy(true)
    setStatus('working')

    try {
      const r = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      const json = (await r.json().catch(() => ({}))) as FinalizeResult
      setResult(json)

      if (!r.ok) {
        throw new Error(json?.error || 'Finalization failed')
      }

      // ✅ Accept BOTH valid “success” shapes:
      const okPaid = json?.paid === true && typeof json?.code === 'string'
      const okPro = json?.pro === true

      if (!okPaid && !okPro) {
        throw new Error('Finalization did not return a paid link or a Pro activation.')
      }

      setStatus('ok')
      setMsg('Finalized ✅')
    } catch (e: any) {
      setStatus('err')
      setMsg(e?.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    finalize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.h1}>Payment successful ✅</div>
          <div style={styles.p}>
            {status === 'working' ? 'Finalizing…' : status === 'ok' ? 'Done.' : status === 'err' ? 'Something went wrong' : ''}
          </div>

          <div style={styles.kv}>
            <div style={styles.k}>
              Session ID
            </div>
            <div style={styles.v}>
              <code style={styles.code}>{sessionId || '(missing)'}</code>
            </div>
          </div>

          {status === 'ok' && isPro && (
            <div style={styles.okBox}>
              <div style={styles.okTitle}>Pro activated ✅</div>
              <div style={styles.okText}>
                {result?.cancel_at_period_end
                  ? `Scheduled to end ${formatDateShort(result?.current_period_end) || '(date pending)'}`
                  : `Renews ${formatDateShort(result?.current_period_end) || '(date pending)'}`}
              </div>
              <a href="/" style={styles.btnPrimary}>
                Back to home
              </a>
              <a href="/billing" style={styles.btnSecondary}>
                Manage subscription
              </a>
            </div>
          )}

          {status === 'ok' && isPaid && (
            <div style={styles.okBox}>
              <div style={styles.okTitle}>Link unlocked ✅</div>
              <div style={styles.okText}>
                Code: <b>{result?.code}</b>
              </div>
              <a href={`/d/${result?.code}`} style={styles.btnPrimary}>
                Go to download
              </a>
              <a href="/" style={styles.btnSecondary}>
                Back to home
              </a>
            </div>
          )}

          {status === 'err' && (
            <div style={styles.errBox}>
              <div style={styles.errTitle}>We couldn’t finalize the purchase.</div>
              <div style={styles.errText}>❌ {msg || 'Unknown error'}</div>

              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={finalize}
                  disabled={busy}
                  style={{ ...styles.btnPrimary, opacity: busy ? 0.7 : 1 }}
                >
                  {busy ? 'Retrying…' : 'Retry finalize'}
                </button>
                <a href="/" style={styles.btnSecondary}>
                  Back to home
                </a>
              </div>

              <div style={styles.hint}>
                If you already paid, wait a few seconds and retry. (In production we’ll use webhooks to avoid this.)
              </div>
            </div>
          )}

          {/* Debug (small) */}
          {result && (
            <details style={styles.details}>
              <summary style={styles.summary}>Show response</summary>
              <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre>
            </details>
          )}
        </div>
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
  },
  container: { maxWidth: 760, margin: '0 auto' },
  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 16,
    display: 'grid',
    gap: 12,
  },
  h1: { fontSize: 22, fontWeight: 950 },
  p: { opacity: 0.8, fontSize: 13 },

  kv: {
    display: 'grid',
    gap: 6,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.20)',
  },
  k: { opacity: 0.7, fontSize: 12 },
  v: { fontSize: 12, fontWeight: 800 },
  code: {
    display: 'inline-block',
    padding: '6px 8px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.25)',
    overflowWrap: 'anywhere',
  },

  okBox: {
    padding: 12,
    borderRadius: 16,
    border: '1px solid rgba(34,197,94,0.25)',
    background: 'rgba(34,197,94,0.10)',
    display: 'grid',
    gap: 10,
  },
  okTitle: { fontWeight: 950 },
  okText: { opacity: 0.9, fontSize: 13, lineHeight: 1.35 },

  errBox: {
    padding: 12,
    borderRadius: 16,
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.10)',
    display: 'grid',
    gap: 10,
  },
  errTitle: { fontWeight: 950 },
  errText: { opacity: 0.9, fontSize: 13, lineHeight: 1.35 },

  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },

  btnPrimary: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  },
  btnSecondary: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 900,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  },
  hint: { opacity: 0.7, fontSize: 12, lineHeight: 1.35 },

  details: {
    marginTop: 6,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.18)',
    padding: 10,
  },
  summary: { cursor: 'pointer', fontWeight: 900, fontSize: 12, opacity: 0.9 },
  pre: {
    margin: 0,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 11,
    lineHeight: 1.35,
    overflowX: 'auto',
  },
}