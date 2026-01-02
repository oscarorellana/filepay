'use client'

import { useEffect, useMemo, useState } from 'react'

type MarkPaidResponse =
  | { paid: true; code: string; paid_links_30d: number }
  | { paid: false }
  | { error: string }

export default function SuccessPage() {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'paid' | 'unpaid' | 'error'>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [paidLinks30d, setPaidLinks30d] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Read session_id from query string (client-side)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('session_id')
    setSessionId(sid)
  }, [])

  const downloadUrl = useMemo(() => {
    if (!code) return null
    return `/dl/${code}`
  }, [code])

  useEffect(() => {
    if (!sessionId) return

    const run = async () => {
      setStatus('verifying')
      setError(null)

      try {
        const res = await fetch('/api/mark-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        })

        if (!res.ok) {
          const txt = await res.text()
          throw new Error(txt || 'Failed to verify payment')
        }

        const data = (await res.json()) as MarkPaidResponse

        if ('error' in data) throw new Error(data.error)

        if (data.paid === true) {
          setCode(data.code)
          setPaidLinks30d(typeof data.paid_links_30d === 'number' ? data.paid_links_30d : null)
          setStatus('paid')
        } else {
          setStatus('unpaid')
        }
      } catch (e: any) {
        console.error(e)
        setError(e?.message ?? 'Failed to verify payment')
        setStatus('error')
      }
    }

    run()
  }, [sessionId])

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: 'system-ui',
        background: 'linear-gradient(180deg, #0b1220 0%, #070a12 100%)',
        color: 'white',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 820,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 18,
          padding: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>Payment successful ✅</h1>
          <span style={{ opacity: 0.7 }}>finalizing your link…</span>
        </div>

        <div style={{ marginTop: 10, opacity: 0.82, fontSize: 13 }}>
          Session ID:{' '}
          <code style={{ opacity: 0.9 }}>{sessionId ?? '(missing session_id)'}</code>
        </div>

        <div style={{ marginTop: 16 }}>
          {status === 'idle' && <div style={{ opacity: 0.85 }}>Loading…</div>}

          {status === 'verifying' && (
            <div style={{ opacity: 0.85 }}>Confirming payment with Stripe…</div>
          )}

          {status === 'unpaid' && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255, 183, 0, 0.12)',
              }}
            >
              <b>Payment not confirmed</b>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                If you just paid, wait a few seconds and refresh this page.
              </div>
            </div>
          )}

          {status === 'error' && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: '1px solid rgba(255,72,72,0.25)',
                background: 'rgba(255,72,72,0.14)',
              }}
            >
              <b>Something went wrong</b>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                {error ?? 'Unknown error.'}
              </div>
            </div>
          )}

          {status === 'paid' && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: '1px solid rgba(0, 214, 143, 0.25)',
                background: 'rgba(0, 214, 143, 0.12)',
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>Your link is ready 🎉</div>

              <div style={{ marginTop: 8, opacity: 0.92 }}>
                Code: <code>{code}</code>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
                  Share or download:
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <a
                    href={downloadUrl ?? '#'}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(72, 118, 255, 0.35)',
                      color: 'white',
                      textDecoration: 'none',
                      fontWeight: 900,
                    }}
                  >
                    Go to download page
                  </a>

                  <span style={{ opacity: 0.78, fontSize: 12 }}>
                    Link: <code>{downloadUrl}</code>
                  </span>
                </div>
              </div>

              {/* Soft upgrade banner */}
              {typeof paidLinks30d === 'number' && paidLinks30d >= 3 && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.14)',
                    background: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>💼 You use FilePay often</div>
                  <div style={{ opacity: 0.92 }}>
                    You’ve created <b>{paidLinks30d}</b> paid links in the last 30 days.
                    <br />
                    Save money with <b>Pro</b>: 50 links/month for $29.
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a
                      href="/pricing"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.18)',
                        background: 'rgba(0, 214, 143, 0.35)',
                        color: 'white',
                        textDecoration: 'none',
                        fontWeight: 900,
                      }}
                    >
                      Upgrade to Pro
                    </a>

                    <span style={{ fontSize: 12, opacity: 0.7, alignSelf: 'center' }}>
                      (no pressure — only if you share files often)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, opacity: 0.88 }}>
          <a href="/" style={{ textDecoration: 'underline', color: 'white' }}>
            Back to home
          </a>
        </div>
      </div>
    </main>
  )
}