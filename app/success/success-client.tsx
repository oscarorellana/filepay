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

export default function SuccessClient() {
  const sp = useSearchParams()
  const sessionId = useMemo(
  () => (sp?.get('session_id') ?? '').trim(),
  [sp]
)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [json, setJson] = useState<FinalizeResponse | null>(null)

  async function finalize() {
    setMsg('')
    setJson(null)

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

      // ✅ Require a meaningful success signal
      const okPaid = j?.paid === true
      const okPro = j?.pro === true
      if (!okPaid && !okPro) {
        throw new Error('Finalization did not return a paid link or a Pro activation.')
      }

      setMsg(okPro ? 'Pro activated ✅' : 'Payment finalized ✅')
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

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Payment successful ✅</h1>

        <div style={styles.block}>
          <div style={styles.label}>Finalizing…</div>
          <div style={styles.mono}>Session ID</div>
          <div style={styles.mono2}>{sessionId || '(missing)'}</div>
        </div>

        {msg && <div style={styles.msg}>{msg}</div>}

        <div style={styles.row}>
          <button
            type="button"
            onClick={finalize}
            disabled={busy}
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

        {json && (
          <details style={styles.details}>
            <summary style={styles.summary}>Show response</summary>
            <pre style={styles.pre}>{JSON.stringify(json, null, 2)}</pre>
          </details>
        )}

        <div style={styles.hint}>
          If you already paid, wait a few seconds and retry. (In production we’ll use webhooks to avoid this.)
        </div>
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
  block: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    padding: 12,
    display: 'grid',
    gap: 6,
  },
  label: { opacity: 0.75, fontSize: 12 },
  mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', opacity: 0.9, fontSize: 12 },
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
  },
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
  hint: { opacity: 0.65, fontSize: 12, lineHeight: 1.35 },
}