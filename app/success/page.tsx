'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic' // <- evita prerender en build

type MarkPaidResponse =
  | { ok: true; paid: true; code: string }
  | {
      ok: true
      pro: true
      stripe_subscription_id?: string | null
      stripe_customer_id?: string | null
      current_period_end?: string | null
      cancel_at_period_end?: boolean
    }
  | { error: string }

export default function SuccessPage() {
  const sp = useSearchParams()
  const sessionId = useMemo(() => (sp?.get('session_id') ?? '').trim(), [sp])

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>('')
  const [data, setData] = useState<any>(null)

  async function finalize() {
    setErr('')
    setBusy(true)
    try {
      if (!sessionId) {
        setErr('Missing session_id in URL.')
        return
      }

      const r = await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      const json = (await r.json().catch(() => ({}))) as MarkPaidResponse
      setData(json)

      if (!r.ok) {
        setErr((json as any)?.error || 'Finalization failed')
        return
      }

      // Valid outcomes:
      const okPaid = (json as any)?.paid === true
      const okPro = (json as any)?.pro === true

      if (!okPaid && !okPro) {
        setErr('Finalization did not return a paid link or a Pro activation.')
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // auto finalize once
    finalize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const title = (data as any)?.pro
    ? 'Pro activated ✅'
    : (data as any)?.paid
      ? 'Payment successful ✅'
      : 'Finalizing…'

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>{title}</h1>

        <div style={styles.row}>
          <div style={styles.label}>Session ID</div>
          <div style={styles.value} title={sessionId}>
            {sessionId || '(missing)'}
          </div>
        </div>

        {busy && <div style={styles.note}>Working…</div>}

        {err && (
          <div style={{ ...styles.note, ...styles.err }}>
            ❌ {err}
          </div>
        )}

        <div style={styles.actions}>
          <button onClick={finalize} disabled={busy || !sessionId} style={styles.btn}>
            {busy ? 'Finalizing…' : 'Retry finalize'}
          </button>

          <a href="/" style={styles.link}>
            Back to home
          </a>

          <a href="/billing" style={styles.link}>
            Manage subscription
          </a>
        </div>

        {data && (
          <details style={styles.details}>
            <summary style={styles.summary}>Show response</summary>
            <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
          </details>
        )}
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    padding: 24,
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.22), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.18), transparent 55%), #07070a',
    color: 'white',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
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
  h1: { margin: 0, fontSize: 22, fontWeight: 950 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' },
  label: { opacity: 0.7, fontSize: 12 },
  value: { fontWeight: 900, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' },
  note: {
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 12,
    opacity: 0.95,
    whiteSpace: 'pre-wrap',
  },
  err: { border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.10)' },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  btn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'rgba(255,255,255,0.10)',
    color: 'white',
    fontWeight: 900,
    cursor: 'pointer',
  },
  link: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    textDecoration: 'none',
  },
  details: { marginTop: 4 },
  summary: { cursor: 'pointer', fontWeight: 900, fontSize: 12, opacity: 0.9 },
  pre: {
    margin: '10px 0 0',
    padding: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 11,
    lineHeight: 1.35,
    overflowX: 'auto',
  },
}