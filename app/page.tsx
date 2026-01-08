'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAY_OPTIONS = [1, 3, 7, 14, 30]

/**
 * UI price map (USD)
 * Make sure /api/checkout uses the same mapping.
 */
const PRICE_BY_DAYS: Record<number, number> = {
  1: 1,
  3: 2,
  7: 3,
  14: 5,
  30: 8,
}

function uid(len = 12) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

function prettyBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

function formatDays(d: number) {
  return `${d} day${d === 1 ? '' : 's'}`
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type SubRow = {
  plan: string | null
  status: string | null
  cancel_at_period_end: boolean | null
  current_period_end: string | null
}

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [isPro, setIsPro] = useState(false)
  const [proCancelAtPeriodEnd, setProCancelAtPeriodEnd] = useState<boolean>(false)
  const [proEndsAt, setProEndsAt] = useState<string | null>(null)

  const [authEmail, setAuthEmail] = useState('')
  const [authStatus, setAuthStatus] = useState<string>('')

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [days, setDays] = useState<number>(14)

  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string>('')

  const priceUsd = useMemo(() => PRICE_BY_DAYS[days] ?? 5, [days])
  const priceLabel = useMemo(() => `$${priceUsd}`, [priceUsd])

  const fileMeta = useMemo(() => {
    if (!file) return null
    return {
      name: file.name,
      type: file.type || 'unknown',
      sizeBytes: file.size,
      size: prettyBytes(file.size),
      isImage: file.type.startsWith('image/'),
    }
  }, [file])

  const planBadge = useMemo(() => {
    if (isPro) {
      const endShort = formatDateShort(proEndsAt)
      if (proCancelAtPeriodEnd) {
        return endShort ? `PRO · Ends ${endShort}` : 'PRO · Ending'
      }
      return endShort ? `PRO · Renews ${endShort}` : 'PRO · Active'
    }
    return 'FREE'
  }, [isPro, proCancelAtPeriodEnd, proEndsAt])

  useEffect(() => {
    let sub: any
    let mounted = true

    async function refreshUser() {
      const { data } = await supabase.auth.getUser()
      const u = data.user ?? null

      if (!mounted) return

      setUserId(u?.id ?? null)
      setUserEmail(u?.email ?? null)

      if (!u?.id) {
        setIsPro(false)
        setProCancelAtPeriodEnd(false)
        setProEndsAt(null)
        return
      }

      // Best-effort sync (so cancel/renew updates show)
      try {
        const { data: sess } = await supabase.auth.getSession()
        const token = sess.session?.access_token
        if (token) {
          await fetch('/api/pro/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {})
        }
      } catch {
        // ignore
      }

      // Read subscription row
      const { data: row, error } = await supabase
        .from('subscriptions')
        .select('plan,status,cancel_at_period_end,current_period_end')
        .eq('user_id', u.id)
        .maybeSingle()

      const subRow = (row ?? null) as SubRow | null
      const pro = !error && subRow?.plan === 'pro' && subRow?.status === 'active'

      setIsPro(Boolean(pro))
      setProCancelAtPeriodEnd(Boolean(subRow?.cancel_at_period_end))
      setProEndsAt(subRow?.current_period_end ?? null)
    }

    refreshUser()

    sub = supabase.auth.onAuthStateChange(() => {
      refreshUser()
    })

    return () => {
      mounted = false
      sub?.data?.subscription?.unsubscribe?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // cleanup preview blob when changing / unmount
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function setPickedFile(f: File | null) {
    setStatus('')
    setFile(f)

    if (previewUrl) URL.revokeObjectURL(previewUrl)

    if (!f) {
      setPreviewUrl(null)
      return
    }

    if (f.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(f))
    else setPreviewUrl(null)
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (busy) return
    const f = e.dataTransfer.files?.[0] ?? null
    if (f) setPickedFile(f)
  }

  async function signInWithEmail() {
    setAuthStatus('')
    const email = authEmail.trim()
    if (!email) {
      setAuthStatus('Please enter an email.')
      return
    }

    try {
      setAuthStatus('Sending sign-in link…')
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw new Error(error.message)
      setAuthStatus('Check your email for the sign-in link.')
    } catch (e: any) {
      setAuthStatus(e?.message ?? 'Sign-in failed.')
    }
  }

  async function signOut() {
    setAuthStatus('')
    await supabase.auth.signOut()
    setUserId(null)
    setUserEmail(null)
    setIsPro(false)
    setProCancelAtPeriodEnd(false)
    setProEndsAt(null)
  }

  async function uploadToSupabase(f: File) {
    const ext = f.name.includes('.') ? f.name.split('.').pop() : ''
    const safeExt = ext ? `.${ext}` : ''
    const path = `${userId ?? 'anon'}/${uid(16)}${safeExt}`

    const { error } = await supabase.storage.from('uploads').upload(path, f, {
      upsert: false,
      contentType: f.type || undefined,
    })

    if (error) throw new Error(error.message)
    return path
  }

  async function createLink(filePath: string) {
    const res = await fetch('/api/create-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: filePath,
        days,
        created_by_user_id: userId, // optional
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || 'Failed to create link')
    return json as { code: string; expires_at?: string; days?: number }
  }

  async function goPayOrProBypass(code: string) {
    if (isPro) {
      window.location.href = `/success?session_id=pro_${code}`
      return
    }

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, days }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.url) throw new Error(json?.error || 'Checkout failed')
    window.location.href = json.url
  }

  async function handleCreateLink() {
    setStatus('')
    if (!file) {
      setStatus('Please select a file first.')
      return
    }

    setBusy(true)
    try {
      setStatus('Uploading…')
      const path = await uploadToSupabase(file)

      setStatus('Generating your link…')
      const { code } = await createLink(path)

      setStatus(isPro ? 'Finishing up…' : 'Redirecting to checkout…')
      await goPayOrProBypass(code)
    } catch (e: any) {
      setStatus(e?.message ?? 'Something went wrong.')
      setBusy(false)
    }
  }

  const primaryLabel = busy
    ? 'Working…'
    : isPro
      ? 'Generate link'
      : `Pay ${priceLabel} & generate link`

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logoDot} />
            <div>
              <div style={styles.brandTop}>
                <h1 style={styles.title}>FilePay</h1>
                <span
                  style={{
                    ...styles.badge,
                    ...(isPro ? styles.badgePro : styles.badgeFree),
                  }}
                  title={isPro ? planBadge : 'FREE'}
                >
                  {planBadge}
                </span>
              </div>
              <p style={styles.subtitle}>
                Upload a file, choose how long the link stays active, and share a secure download link.
              </p>
            </div>
          </div>

          <div style={styles.account}>
            {userEmail ? (
              <>
                <div style={styles.accountTop}>
                  <div style={styles.accountLine}>
                    Signed in as <b>{userEmail}</b>
                  </div>
                  <div style={styles.accountActions}>
                    <a href="/pricing" style={styles.linkBtn}>
                      Pricing
                    </a>
                    <a href="/billing" style={styles.linkBtn}>
                    Manage subscription
                    </a>
                    <button
                      type="button"
                      onClick={signOut}
                      style={styles.linkBtn}
                      disabled={busy}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={styles.accountLine}>
                  <b>Sign in</b> to unlock Pro perks (if you have them).
                </div>
                <div style={styles.authRow}>
                  <input
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={styles.input}
                    disabled={busy}
                    inputMode="email"
                  />
                  <button
                    type="button"
                    onClick={signInWithEmail}
                    style={styles.primaryBtnSmall}
                    disabled={busy}
                  >
                    Sign in
                  </button>
                </div>
                {authStatus && <div style={styles.hint}>{authStatus}</div>}
                <div style={styles.accountActions}>
                  <a href="/pricing" style={styles.linkBtn}>
                    View pricing
                  </a>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main */}
        <div style={styles.grid}>
          {/* Left: create link */}
          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <div style={styles.cardTitle}>Create a download link</div>
                <div style={styles.cardDesc}>
                  Pick a duration, upload your file, then generate a shareable link.
                </div>
              </div>

              {/* Compact price hint */}
              <div style={styles.pricePill}>
                {isPro ? (
                  <>
                    <span style={{ fontWeight: 950 }}>Pro</span> includes this
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 950 }}>{priceLabel}</span> · {formatDays(days)}
                  </>
                )}
              </div>
            </div>

            <div style={styles.body}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                disabled={busy}
              />

              {/* Dropzone */}
              <div
                style={{
                  ...styles.dropzone,
                  ...(file ? styles.dropzoneHasFile : {}),
                  ...(busy ? styles.dropzoneBusy : {}),
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => !busy && openFilePicker()}
                role="button"
                tabIndex={0}
                title="Click to pick a file, or drag & drop"
              >
                <div style={styles.dropTop}>
                  <div style={styles.dropIcon}>⬆️</div>
                  <div>
                    <div style={styles.dropTitle}>
                      {file ? 'Ready to share' : 'Drop a file here'}
                    </div>
                    <div style={styles.dropSub}>
                      {file
                        ? `${fileMeta?.name} · ${fileMeta?.size} · ${fileMeta?.type}`
                        : 'or click to browse (images, PDFs, ZIPs, and more)'}
                    </div>
                  </div>
                </div>

                {file && (
                  <div style={styles.dropActions}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openFilePicker()
                      }}
                      style={styles.secondaryBtnSmall}
                      disabled={busy}
                    >
                      Change file
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPickedFile(null)
                      }}
                      style={styles.secondaryBtnSmall}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Row: duration + action */}
              <div style={styles.controlsRow}>
                <div style={styles.field}>
                  <div style={styles.label}>Link duration</div>
                  <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    disabled={busy}
                    style={styles.select}
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {formatDays(d)}
                      </option>
                    ))}
                  </select>

                  <div style={styles.hint}>
                    {isPro ? (
                      <>
                        Expires after <b>{formatDays(days)}</b>. Included in Pro.
                      </>
                    ) : (
                      <>
                        Expires after <b>{formatDays(days)}</b>. Price: <b>{priceLabel}</b>.
                      </>
                    )}
                  </div>
                </div>

                <div style={styles.field}>
                  <div style={styles.label}>Action</div>
                  <button
                    type="button"
                    onClick={handleCreateLink}
                    disabled={busy || !file}
                    style={{
                      ...styles.primaryBtn,
                      opacity: busy || !file ? 0.6 : 1,
                      cursor: busy || !file ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {primaryLabel}
                  </button>
                  <div style={styles.hint}>
                    {isPro
                      ? 'No checkout needed — your link is ready instantly.'
                      : 'Complete checkout to unlock the download link.'}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div style={styles.previewWrap}>
                <div style={styles.previewHeader}>
                  <div style={styles.previewTitle}>Preview</div>
                  {fileMeta && (
                    <div style={styles.previewMeta}>
                      {fileMeta.isImage ? 'Image' : 'File'} · {prettyBytes(fileMeta.sizeBytes)}
                    </div>
                  )}
                </div>

                <div style={styles.previewBox}>
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="preview"
                      style={styles.previewImg}
                    />
                  ) : (
                    <div style={styles.previewEmpty}>
                      {file
                        ? fileMeta?.isImage
                          ? 'Preview unavailable.'
                          : 'No preview for this file type.'
                        : 'Select an image to see a preview here.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              {status && <div style={styles.statusBox}>{status}</div>}
            </div>
          </section>

          {/* Right: onboarding */}
          <aside style={styles.sideCard}>
            <div style={styles.sideTitle}>How it works</div>

            <Step
              n="1"
              title="Upload"
              text="Choose the file you want to share."
            />
            <Step
              n="2"
              title="Set a duration"
              text="Pick how long the link should stay active."
            />
            <Step
              n="3"
              title={isPro ? 'Instant access' : 'Unlock access'}
              text={isPro ? 'Pro skips checkout — link is ready right away.' : 'Checkout unlocks the download link.'}
            />
            <Step
              n="4"
              title="Share"
              text="Send the link to your client. It expires automatically."
            />

            <div style={styles.divider} />

            {!isPro ? (
              <div style={styles.ctaCard}>
                <div style={{ fontWeight: 950 }}>Skip checkout every time</div>
                <div style={styles.ctaText}>
                  Go Pro ($9/mo) to create unlimited links without per-link payments.
                </div>
                <a href="/pricing" style={styles.ctaBtn}>
                  Upgrade to Pro →
                </a>
              </div>
            ) : (
              <div style={styles.ctaCard}>
                <div style={{ fontWeight: 950 }}>You’re Pro ✅</div>
                <div style={styles.ctaText}>
                  Links finalize instantly. Manage billing anytime.
                </div>
                <a href="/billing" style={styles.ctaBtn}>
                  Manage billing →
                </a>
              </div>
            )}
          </aside>
        </div>

        <footer style={styles.footer}>
          Selected duration: <b>{formatDays(days)}</b>
          {!isPro && (
            <>
              {' '}· Price: <b>{priceLabel}</b>
            </>
          )}
        </footer>
      </div>
    </main>
  )
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div style={styles.step}>
      <div style={styles.stepTop}>
        <div style={styles.stepNum}>{n}</div>
        <div style={styles.stepTitle}>{title}</div>
      </div>
      <div style={styles.stepText}>{text}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    color: '#fff',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.26), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.22), transparent 55%), #07070a',
    padding: 24,
  },
  container: { maxWidth: 1080, margin: '0 auto' },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  brand: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 10,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.9))',
    boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
  },
  brandTop: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 34, letterSpacing: -0.4 },
  subtitle: { margin: '6px 0 0', opacity: 0.8, maxWidth: 560, lineHeight: 1.35, fontSize: 13 },

  badge: {
    fontSize: 12,
    fontWeight: 950,
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.14)',
  },
  badgePro: { background: 'rgba(124,58,237,0.22)' },
  badgeFree: { background: 'rgba(255,255,255,0.06)' },

  account: {
    width: 380,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 14,
  },
  accountTop: { display: 'grid', gap: 10 },
  accountLine: { fontSize: 13, opacity: 0.92, lineHeight: 1.35 },
  accountActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },

  linkBtn: {
    display: 'inline-block',
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    fontSize: 12,
    textDecoration: 'none',
    cursor: 'pointer',
  },

  authRow: { display: 'flex', gap: 10, marginTop: 10 },
  input: {
    flex: 1,
    padding: '12px 12px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(0,0,0,0.35)',
    color: 'white',
    outline: 'none',
  },

  grid: { display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 16 },

  card: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: { fontWeight: 950, fontSize: 16 },
  cardDesc: { marginTop: 6, fontSize: 13, opacity: 0.75, lineHeight: 1.35 },
  pricePill: {
    padding: '8px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.22)',
    fontSize: 12,
    opacity: 0.92,
    whiteSpace: 'nowrap',
  },

  body: { padding: 16, display: 'grid', gap: 14 },

  dropzone: {
    borderRadius: 18,
    border: '1px dashed rgba(255,255,255,0.18)',
    background: 'rgba(0,0,0,0.22)',
    padding: 14,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'transform 120ms ease',
  },
  dropzoneHasFile: {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(0,0,0,0.26)',
  },
  dropzoneBusy: { opacity: 0.7, cursor: 'not-allowed' },

  dropTop: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  dropIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    fontSize: 16,
  },
  dropTitle: { fontWeight: 950, fontSize: 14 },
  dropSub: { marginTop: 4, opacity: 0.78, fontSize: 12, lineHeight: 1.35 },

  dropActions: { marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' },

  controlsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },

  field: { display: 'grid', gap: 8 },
  label: { fontSize: 13, opacity: 0.85, fontWeight: 700 },

  select: {
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(0,0,0,0.35)',
    color: 'white',
    outline: 'none',
    cursor: 'pointer',
  },

  primaryBtn: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  },
  primaryBtnSmall: {
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))',
    color: '#0b0b10',
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
    whiteSpace: 'nowrap',
  },

  secondaryBtnSmall: {
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    fontSize: 12,
    cursor: 'pointer',
  },

  hint: { fontSize: 12, opacity: 0.75, lineHeight: 1.35 },
  codeInline: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    padding: '2px 6px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.10)',
  },

  previewWrap: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  previewHeader: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'baseline',
  },
  previewTitle: { fontWeight: 950, fontSize: 13 },
  previewMeta: { fontSize: 12, opacity: 0.75 },

  previewBox: {
    minHeight: 200,
    display: 'grid',
    placeItems: 'center',
    padding: 12,
  },
  previewImg: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: 14,
  },
  previewEmpty: { opacity: 0.75, fontSize: 13, textAlign: 'center', lineHeight: 1.35 },

  statusBox: {
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(124,58,237,0.14)',
    fontSize: 13,
    whiteSpace: 'pre-wrap',
  },

  sideCard: {
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    padding: 16,
    display: 'grid',
    gap: 12,
    alignContent: 'start',
  },
  sideTitle: { fontWeight: 950, fontSize: 16 },

  step: {
    padding: 12,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(0,0,0,0.22)',
  },
  stepTop: { display: 'flex', gap: 10, alignItems: 'baseline' },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    fontSize: 12,
    fontWeight: 950,
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  stepTitle: { fontWeight: 950 },
  stepText: { marginTop: 6, fontSize: 13, opacity: 0.82, lineHeight: 1.35 },

  divider: { height: 1, background: 'rgba(255,255,255,0.10)', margin: '6px 0' },

  ctaCard: {
    padding: 12,
    borderRadius: 16,
    border: '1px solid rgba(59,130,246,0.20)',
    background: 'rgba(59,130,246,0.10)',
    display: 'grid',
    gap: 10,
  },
  ctaText: { fontSize: 13, opacity: 0.85, lineHeight: 1.35 },
  ctaBtn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.95)',
    color: '#0b0b10',
    fontWeight: 950,
    fontSize: 12,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
    textAlign: 'center',
    display: 'inline-block',
    width: 'fit-content',
  },

  footer: { marginTop: 14, opacity: 0.6, fontSize: 12 },
}