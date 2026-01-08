'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SubRow = {
  plan: string | null
  status: string | null
  cancel_at_period_end: boolean | null
  current_period_end: string | null // timestamptz ISO
  updated_at: string | null
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function BillingPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sub, setSub] = useState<SubRow | null>(null)

  const isSignedIn = Boolean(email)

  const isPro = useMemo(() => sub?.plan === 'pro' && sub?.status === 'active', [sub])

  const cancelScheduled = useMemo(() => Boolean(sub?.cancel_at_period_end), [sub])

  const periodEndLabel = useMemo(() => formatDateShort(sub?.current_period_end) || '', [sub])

  // This is the customer-facing “renew/ends” label
  const billingTimeline = useMemo(() => {
    if (!isSignedIn) return null
    if (!isPro) return null

    // If cancel scheduled => “Ends on …”
    if (cancelScheduled) {
      return periodEndLabel
        ? { label: `Ends on ${periodEndLabel}`, tone: 'warn' as const }
        : { label: 'End date will appear shortly. Hit Refresh.', tone: 'warn' as const }
    }

    // Otherwise => “Renews on …”
    return periodEndLabel
      ? { label: `Renews on ${periodEndLabel}`, tone: 'pro' as const }
      : { label: 'Next billing date will appear shortly. Hit Refresh.', tone: 'pro' as const }
  }, [isSignedIn, isPro, cancelScheduled, periodEndLabel])

  const badge = useMemo(() => {
    if (!isSignedIn) return { label: 'SIGN IN', tone: 'free' as const }
    if (!isPro) return { label: 'FREE', tone: 'free' as const }
    return cancelScheduled
      ? { label: 'PRO · Cancel scheduled', tone: 'warn' as const }
      : { label: 'PRO · Active', tone: 'pro' as const }
  }, [isSignedIn, isPro, cancelScheduled])

  async function loadFromDb() {
    setMsg('')
    setBusy(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      setEmail(u.user?.email ?? null)

      if (!u.user?.id) {
        setSub(null)
        return
      }

      const { data: row, error } = await supabase
        .from('subscriptions')
        .select('plan,status,cancel_at_period_end,current_period_end,updated_at')
        .eq('user_id', u.user.id)
        .maybeSingle()

      if (error) throw new Error(error.message)
      setSub((row ?? null) as SubRow | null)
    } catch (e: any) {
      setMsg(e?.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function syncFromStripe() {
    // Customer-friendly: just sync then load DB (no JSON shown)
    setMsg('')
    setBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setMsg('Please sign in first.')
        return
      }

      const res = await fetch('/api/pro/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || json?.message || 'Sync failed')

      await loadFromDb()
    } catch (e: any) {
      setMsg(e?.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function openPortal() {
    setMsg('')
    setBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setMsg('Please sign in first.')
        return
      }

      const res = await fetch('/api/pro/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.url) throw new Error(json?.error || 'Failed to open subscription settings')

      window.location.href = json.url
    } catch (e: any) {
      setMsg(e?.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // On open: show latest possible state
    ;(async () => {
      await loadFromDb()
      if (isSignedIn) {
        // If signed in, do one sync attempt (quiet)
        await syncFromStripe()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div>
              <h1 style={styles.h1}>Manage subscription</h1>
              <p style={styles.p}>Update your plan, payment method, or cancel anytime.</p>

              <p style={{ ...styles.p, opacity: 0.7 }}>
                {email ? (
                  <>
                    Signed in as <b>{email}</b>
                  </>
                ) : (
                  'Not signed in'
                )}
              </p>

              <div
                style={{
                  ...styles.badge,
                  ...(badge.tone === 'pro'
                    ? styles.badgePro
                    : badge.tone === 'warn'
                      ? styles.badgeWarn
                      : styles.badgeFree),
                }}
              >
                {badge.label}
              </div>
            </div>

            <a href="/" style={styles.linkBtn}>
              ← Back
            </a>
          </div>

          {/* Customer summary */}
          <div style={styles.summary}>
            <div style={styles.summaryRow}>
              <div style={styles.summaryLabel}>Plan</div>
              <div style={styles.summaryValue}>{isSignedIn ? (isPro ? 'Pro' : 'Free') : '—'}</div>
            </div>

            {isSignedIn && isPro && (
              <>
                <div style={styles.summaryRow}>
                  <div style={styles.summaryLabel}>Cancel scheduled</div>
                  <div style={styles.summaryValue}>{cancelScheduled ? 'Yes' : 'No'}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryLabel}>{cancelScheduled ? 'Ends' : 'Renews'}</div>
                  <div style={styles.summaryValue}>
                    {billingTimeline?.label ?? 'Next billing date will appear shortly. Hit Refresh.'}
                  </div>
                </div>
              </>
            )}

            {isSignedIn && !isPro && (
              <div style={styles.smallHint}>
                Want unlimited links without paying per link? Check <b>Pricing</b> to upgrade.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openPortal}
            style={{ ...styles.primaryBtn, opacity: busy ? 0.75 : 1 }}
            disabled={busy}
          >
            {busy ? 'Opening…' : 'Manage subscription'}
          </button>

          <div style={styles.secondaryRow}>
            <button
              type="button"
              onClick={syncFromStripe}
              style={{ ...styles.secondaryBtn, opacity: busy ? 0.75 : 1 }}
              disabled={busy}
              title="If you just cancelled or updated your plan, press this."
            >
              {busy ? 'Refreshing…' : 'Refresh status'}
            </button>

            {!isPro && (
              <a href="/pricing" style={styles.secondaryLink}>
                View pricing
              </a>
            )}
          </div>

          {msg && <div style={styles.note}>{msg}</div>}

          <div style={styles.smallHint}>
            After cancelling or changing billing, it can take a moment to update. Use <b>Refresh status</b>.
          </div>
        </div>
      </div>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.22), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.18), transparent 55%), #07070a',
    color: 'white',
  },
  container: { maxWidth: 820, margin: '0 auto' },
  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 16,
    display: 'grid',
    gap: 14,
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  h1: { margin: 0, fontSize: 28, fontWeight: 950, letterSpacing: -0.2 },
  p: { margin: '6px 0 0', opacity: 0.8, fontSize: 13, lineHeight: 1.35 },

  badge: {
    marginTop: 10,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: '1px solid rgba(255,255,255,0.14)',
    width: 'fit-content',
  },
  badgePro: { background: 'rgba(124,58,237,0.22)' },
  badgeWarn: { background: 'rgba(245,158,11,0.18)' },
  badgeFree: { background: 'rgba(255,255,255,0.06)' },

  summary: {
    padding: 12,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.18)',
    display: 'grid',
    gap: 10,
  },
  summaryRow: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' },
  summaryLabel: { opacity: 0.75, fontSize: 12 },
  summaryValue: { fontWeight: 950, fontSize: 12, textAlign: 'right' },

  primaryBtn: {
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  },

  secondaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: 12,
  },
  secondaryLink: {
    display: 'inline-block',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: 'white',
    fontWeight: 900,
    fontSize: 12,
    textDecoration: 'none',
  },

  linkBtn: {
    display: 'inline-block',
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 800,
    fontSize: 12,
    textDecoration: 'none',
  },

  note: {
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: 'pre-wrap',
  },

  smallHint: { marginTop: 2, opacity: 0.65, fontSize: 12, lineHeight: 1.35 },
}