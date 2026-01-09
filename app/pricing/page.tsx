'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Match your per-link duration options
const DAY_OPTIONS = [1, 3, 7, 14, 30] as const

// UI price map (USD) — must match /api/checkout mapping
const PRICE_BY_DAYS: Record<number, number> = {
  1: 1,
  3: 2,
  7: 3,
  14: 5,
  30: 8,
}

type SubRow = {
  plan: string | null
  status: string | null
  cancel_at_period_end: boolean | null
  current_period_end: string | null // timestamptz ISO
}

function formatDays(d: number) {
  return `${d} day${d === 1 ? '' : 's'}`
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function PricingPage() {
  const [email, setEmail] = useState<string | null>(null)

  const [sub, setSub] = useState<SubRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Simple calculator: how many links until Pro makes sense?
  const [calcDays, setCalcDays] = useState<(typeof DAY_OPTIONS)[number]>(14)
  const perLink = useMemo(() => PRICE_BY_DAYS[calcDays] ?? 5, [calcDays])
  const breakEvenLinks = useMemo(() => {
    // Pro is $9/month
    const pro = 9
    return Math.ceil(pro / Math.max(1, perLink))
  }, [perLink])

  const isPro = useMemo(() => sub?.plan === 'pro' && sub?.status === 'active', [sub])

  const proStateLabel = useMemo(() => {
    if (!isPro) return null
    const ends = formatDateShort(sub?.current_period_end)
    if (sub?.cancel_at_period_end) {
      return ends ? `Pro (scheduled to end ${ends})` : 'Pro (scheduled to end)'
    }
    return ends ? `Pro (renews ${ends})` : 'Pro (active)'
  }, [isPro, sub])

  async function load() {
    setMsg('')
    setBusy(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const user = u.user ?? null
      setEmail(user?.email ?? null)

      if (!user?.id) {
        setSub(null)
        return
      }

      // Best-effort sync so customer sees latest renewal/cancel flags
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (token) {
        // ✅ FIX: correct path (no /pro/pro)
        await fetch('/api/pro/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      }

      const { data: row, error } = await supabase
        .from('subscriptions')
        .select('plan,status,cancel_at_period_end,current_period_end')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw new Error(error.message)
      setSub((row ?? null) as SubRow | null)
    } catch (e: any) {
      setMsg(e?.message ?? 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function upgradeToPro() {
    setMsg('')
    setBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setMsg('Please sign in first.')
        setBusy(false)
        return
      }

      const res = await fetch('/api/pro/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.url) throw new Error((json as any)?.error || 'Failed to start Pro checkout')

      window.location.href = (json as any).url
    } catch (e: any) {
      setMsg(e?.message ?? 'Upgrade failed')
      setBusy(false)
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Top */}
        <header style={styles.top}>
          <div style={styles.brandRow}>
            <div style={styles.dot} />
            <div>
              <h1 style={styles.h1}>Pay per link — or never again.</h1>
              <p style={styles.p}>
                Upload a file and share a secure download link. Pay only when you need it, or go Pro and skip payments.
              </p>

              <div style={styles.metaRow}>
                <span style={styles.metaPill}>
                  {email ? (
                    <>
                      Signed in as <b>{email}</b>
                    </>
                  ) : (
                    <>Not signed in</>
                  )}
                </span>

                {isPro && (
                  <span style={{ ...styles.metaPill, ...styles.metaPillPro }}>
                    {proStateLabel ?? 'Pro'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={styles.topRight}>
            <a href="/" style={styles.linkBtn}>
              ← Back to home
            </a>
            {isPro && (
              <a href="/billing" style={styles.primaryOutlineBtn}>
                Manage subscription
              </a>
            )}
          </div>
        </header>

        {/* Plans */}
        <div style={styles.grid}>
          {/* Pay per link */}
          <section style={styles.card}>
            <div style={styles.cardTop}>
              <div>
                <div style={styles.planName}>Pay per link</div>
                <div style={styles.priceBig}>From $1</div>
                <div style={styles.priceSub}>Only pay when you share a file</div>
              </div>
              <div style={styles.pill}>Flexible</div>
            </div>

            <ul style={styles.ul}>
              <li>Choose how long the link stays active</li>
              <li>Perfect for occasional sharing</li>
              <li>No monthly commitment</li>
            </ul>

            <div style={styles.smallBox}>
              <div style={styles.smallLabel}>Quick example</div>
              <div style={styles.smallText}>
                A <b>{formatDays(calcDays)}</b> link costs <b>${perLink}</b>.
              </div>

              <div style={styles.calcRow}>
                <select
                  value={calcDays}
                  onChange={(e) => setCalcDays(Number(e.target.value) as any)}
                  style={styles.select}
                  disabled={busy}
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {formatDays(d)}
                    </option>
                  ))}
                </select>

                <div style={styles.calcHint}>
                  Pro ($9/mo) breaks even at <b>{breakEvenLinks}</b> link{breakEvenLinks === 1 ? '' : 's'}.
                </div>
              </div>
            </div>

            <a href="/" style={styles.secondaryBtn}>
              Create a link
            </a>
          </section>

          {/* Pro */}
          <section style={{ ...styles.card, ...styles.cardPro }}>
            <div style={styles.cardTop}>
              <div>
                <div style={styles.planName}>Pro</div>
                <div style={styles.priceBig}>$9 / month</div>
                <div style={styles.priceSub}>Unlimited links, no per-link checkout</div>
              </div>

              <div style={{ ...styles.pill, ...styles.pillPro }}>Recommended</div>
            </div>

            <ul style={styles.ul}>
              <li>
                <b>Unlimited</b> download links
              </li>
              <li>
                <b>No checkout</b> every time
              </li>
              <li>Instant finalize flow</li>
              <li>Cancel anytime</li>
            </ul>

            {!isPro ? (
              <button
                type="button"
                onClick={upgradeToPro}
                style={{ ...styles.primaryBtn, opacity: busy ? 0.75 : 1 }}
                disabled={busy}
              >
                {busy ? 'Starting checkout…' : 'Upgrade to Pro'}
              </button>
            ) : (
              <a href="/billing" style={styles.primaryBtn}>
                Manage subscription
              </a>
            )}

            <div style={styles.trustRow}>
              <div style={styles.trustItem}>Cancel anytime</div>
              <div style={styles.trustDot} />
              <div style={styles.trustItem}>Secure payments</div>
              <div style={styles.trustDot} />
              <div style={styles.trustItem}>No long-term contract</div>
            </div>
          </section>
        </div>

        {msg && <div style={styles.note}>{msg}</div>}

        {/* FAQ / reassurance */}
        <section style={styles.faq}>
          <div style={styles.faqTitle}>Common questions</div>

          <div style={styles.qa}>
            <div style={styles.q}>When should I choose Pro?</div>
            <div style={styles.a}>
              If you create links regularly (for clients, freelancers, recurring work), Pro removes checkout friction and saves money fast.
            </div>
          </div>

          <div style={styles.qa}>
            <div style={styles.q}>Can I cancel?</div>
            <div style={styles.a}>
              Yes — cancel anytime. If you schedule a cancellation, your plan stays active until the end of the current billing period.
            </div>
          </div>

          <div style={styles.qa}>
            <div style={styles.q}>What if I just need one link?</div>
            <div style={styles.a}>
              Use Pay per link. It’s built for one-off sharing and short projects.
            </div>
          </div>
        </section>

        <div style={styles.footer}>Tip: Add this page to your main nav once you’re ready to launch publicly.</div>
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
  container: { maxWidth: 1040, margin: '0 auto' },

  top: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' },
  brandRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  dot: {
    width: 12,
    height: 12,
    marginTop: 10,
    borderRadius: 999,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.9))',
  },
  h1: { margin: 0, fontSize: 34, fontWeight: 950, letterSpacing: -0.3, lineHeight: 1.05 },
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
  metaPillPro: { background: 'rgba(124,58,237,0.18)' },

  topRight: { display: 'grid', gap: 10, justifyItems: 'end' },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 },

  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 16,
    display: 'grid',
    gap: 12,
    alignContent: 'start',
  },
  cardPro: {
    border: '1px solid rgba(59,130,246,0.22)',
    background: 'rgba(59,130,246,0.08)',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },

  planName: { fontWeight: 950, fontSize: 16 },
  priceBig: { marginTop: 6, fontSize: 28, fontWeight: 950, letterSpacing: -0.2 },
  priceSub: { marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.35 },

  pill: {
    fontSize: 12,
    fontWeight: 900,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
  },
  pillPro: { background: 'rgba(255,255,255,0.12)' },

  ul: { margin: 0, paddingLeft: 18, opacity: 0.92, lineHeight: 1.75, fontSize: 13 },

  smallBox: {
    padding: 12,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    display: 'grid',
    gap: 8,
  },
  smallLabel: { fontSize: 12, fontWeight: 900, opacity: 0.85 },
  smallText: { fontSize: 13, opacity: 0.85, lineHeight: 1.35 },

  calcRow: { display: 'grid', gap: 8 },
  calcHint: { fontSize: 12, opacity: 0.75, lineHeight: 1.35 },

  select: {
    padding: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(0,0,0,0.35)',
    color: 'white',
    outline: 'none',
    cursor: 'pointer',
  },

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
    textAlign: 'center',
  },
  primaryOutlineBtn: {
    display: 'inline-block',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 900,
    textDecoration: 'none',
    cursor: 'pointer',
    textAlign: 'center',
  },
  secondaryBtn: {
    display: 'inline-block',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 900,
    textDecoration: 'none',
    cursor: 'pointer',
    textAlign: 'center',
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
  },

  trustRow: {
    marginTop: 2,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    opacity: 0.75,
    fontSize: 12,
  },
  trustItem: { whiteSpace: 'nowrap' },
  trustDot: { width: 4, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.35)' },

  note: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: 'pre-wrap',
  },

  faq: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.30)',
    display: 'grid',
    gap: 12,
  },
  faqTitle: { fontSize: 14, fontWeight: 950 },
  qa: { display: 'grid', gap: 6 },
  q: { fontSize: 13, fontWeight: 900, opacity: 0.95 },
  a: { fontSize: 13, opacity: 0.78, lineHeight: 1.45 },

  footer: { marginTop: 14, opacity: 0.55, fontSize: 12, textAlign: 'center' },
}