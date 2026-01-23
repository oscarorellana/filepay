'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import { track } from '@vercel/analytics'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MAX_BYTES_LOGGED = 2 * 1024 * 1024 * 1024 // 2GB
const MAX_BYTES_ANON = 500 * 1024 * 1024 // 500MB

const BLOCKED_EXT = new Set([
  'exe','msi','dmg','pkg','bat','cmd','ps1','sh',
  'vbs','js','jar','lnk','scr','iso'
])

function getExt(name: string) {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

function isBlockedFile(f: File) {
  const ext = getExt(f.name)
  return ext ? BLOCKED_EXT.has(ext) : false
}

const DAY_OPTIONS = [1, 3, 7, 14, 30]

const PRICE_BY_DAYS: Record<number, number> = {
  1: 1,
  3: 2,
  7: 3,
  14: 5,
  30: 8,
}
    function useIsMobile(bp = 900) {
      const [isMobile, setIsMobile] = useState(false)

      useEffect(() => {
        if (typeof window === 'undefined') return
        const mq = window.matchMedia(`(max-width: ${bp}px)`)
        const onChange = () => setIsMobile(mq.matches)
        onChange()

        if (mq.addEventListener) mq.addEventListener('change', onChange)
        else mq.addListener(onChange)

        return () => {
          if (mq.removeEventListener) mq.removeEventListener('change', onChange)
          else mq.removeListener(onChange)
        }
      }, [bp])

      return isMobile
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
      const isMobile = useIsMobile(900)
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
      // ✅ AQUÍ va esto
      const [accepted, setAccepted] = useState(false)
      
      const canGenerate = !!file && accepted && !busy

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
          if (proCancelAtPeriodEnd) return endShort ? `PRO · Ends ${endShort}` : 'PRO · Ending'
          return endShort ? `PRO · Renews ${endShort}` : 'PRO · Active'
        }
       return 'PAY PER LINK'
      }, [isPro, proCancelAtPeriodEnd, proEndsAt])

    useEffect(() => {
      let sub: any
      let mounted = true

      async function refreshUser() {
        try {
          // 1) session primero (más confiable en App Router)
          const { data: sessData } = await supabase.auth.getSession()
          const session = sessData.session ?? null
          const u = session?.user ?? null

          if (!mounted) return

          setUserId(u?.id ?? null)
          setUserEmail(u?.email ?? null)

          if (!u?.id) {
            setIsPro(false)
            setProCancelAtPeriodEnd(false)
            setProEndsAt(null)
            return
          }

          // 2) sync best-effort (trae cancel/renew/current_period_end)
          const token = session?.access_token
          if (token) {
            await fetch('/api/pro/sync', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {})
          }

          // 3) Reintenta leer DB (Stripe/Supabase a veces tardan 0.5-2s)
          let tries = 0
          let subRow: SubRow | null = null
          let lastErr: any = null

          while (tries < 3) {
            const { data: row, error } = await supabase
              .from('subscriptions')
              .select('plan,status,cancel_at_period_end,current_period_end')
              .eq('user_id', u.id)
              .maybeSingle()

            if (!error) {
              subRow = (row ?? null) as SubRow | null
              const pro = subRow?.plan === 'pro' && subRow?.status === 'active'

              // si ya es pro, o si al menos ya existe row, paramos
              if (pro || subRow) break
            } else {
              lastErr = error
            }

            tries += 1
            // espera cortita antes del siguiente intento
            await new Promise((r) => setTimeout(r, 800))
          }

          // si hubo error y nunca obtuvimos row, no crasheamos
          if (lastErr && !subRow) {
            // opcional: console.warn('subscriptions read error:', lastErr)
          }

          const pro = subRow?.plan === 'pro' && subRow?.status === 'active'
          setIsPro(Boolean(pro))
          setProCancelAtPeriodEnd(Boolean(subRow?.cancel_at_period_end))
          setProEndsAt(subRow?.current_period_end ?? null)
        } catch {
          // no rompas el home por un fallo temporal
        }
      }

      // first load
      refreshUser()

      // auth changes
      sub = supabase.auth.onAuthStateChange(() => {
        refreshUser()
      })

      // ✅ SUPER importante: cuando vuelves desde Stripe, refresca
      const onFocus = () => refreshUser()
      const onVis = () => {
        if (!document.hidden) refreshUser()
      }
      window.addEventListener('focus', onFocus)
      document.addEventListener('visibilitychange', onVis)

      return () => {
        mounted = false
        sub?.data?.subscription?.unsubscribe?.()
        window.removeEventListener('focus', onFocus)
        document.removeEventListener('visibilitychange', onVis)
      }
    }, [])

      useEffect(() => {
        return () => {
          if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
      }, [previewUrl])

      function setPickedFile(f: File | null) {
  setStatus('')

  if (!f) {
    setFile(null)
    setPreviewUrl(null)
    return
  }

  const maxBytes = userId ? MAX_BYTES_LOGGED : MAX_BYTES_ANON

  if (isBlockedFile(f)) {
    setStatus('This file type is not allowed for safety reasons.')
    setFile(null)
    setPreviewUrl(null)
    return
  }

  if (f.size > maxBytes) {
    setStatus(
      `File too large. Max size is ${prettyBytes(maxBytes)}.`
    )
    setFile(null)
    setPreviewUrl(null)
    return
  }

  setFile(f)
  if (previewUrl) URL.revokeObjectURL(previewUrl)
  if (f.type.startsWith('image/')) setPreviewUrl(URL.createObjectURL(f))
  else setPreviewUrl(null)
}

      function openFilePicker() {
        fileInputRef.current?.click()
      }

      function onDrop(e: DragEvent<HTMLDivElement>) {
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
          setAuthStatus('Sending magic link…')
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || window.location.origin

          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${siteUrl}/auth/callback` },
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

    async function createLink(filePath: string, fileBytes: number | null) {
      const res = await fetch('/api/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: filePath,
          file_bytes: fileBytes,
          days,
          created_by_user_id: userId,
          accepted,
          tos_version: '2026-01-18',
          privacy_version: '2026-01-18',
        }),
      })

      const json = (await res.json()) as any
      if (!res.ok) throw new Error(json?.error || 'Failed to create link')
      return json as { code: string; expires_at: string; days: number; file_bytes: number | null }
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
    track('generate_link_blocked', { reason: 'no_file' })
    return
  }

  const maxBytes = userId ? MAX_BYTES_LOGGED : MAX_BYTES_ANON

  if (file.size > maxBytes) {
    setStatus(`File too large. Max size is ${prettyBytes(maxBytes)}.`)
    track('generate_link_blocked', {
      reason: 'too_large',
      max_mb: String(Math.round(maxBytes / 1024 / 1024)),
      size_mb: String(Math.round(file.size / 1024 / 1024)),
      ext: getExt(file.name) || 'unknown',
      is_signed_in: userId ? '1' : '0',
    })
    return
  }

  if (isBlockedFile(file)) {
    setStatus('This file type is not allowed for safety reasons.')
    track('generate_link_blocked', {
      reason: 'blocked_ext',
      ext: getExt(file.name) || 'unknown',
      is_signed_in: userId ? '1' : '0',
    })
    return
  }

  if (!accepted) {
    setStatus('You must accept the Terms of Service to continue.')
    track('generate_link_blocked', { reason: 'not_accepted' })
    return
  }

  track('generate_link_clicked', {
    is_pro: isPro ? '1' : '0',
    days: String(days),
    size_mb: String(Math.round(file.size / 1024 / 1024)),
    ext: getExt(file.name) || 'unknown',
    is_signed_in: userId ? '1' : '0',
  })

  setBusy(true)

  try {
    setStatus('Uploading…')
    const path = await uploadToSupabase(file)
    track('upload_success', { is_pro: isPro ? '1' : '0' })

    setStatus('Creating link…')
    const meta = await createLink(path, file.size)
    track('create_link_success', { is_pro: isPro ? '1' : '0', days: String(days) })

    setStatus(isPro ? 'Finalizing…' : 'Redirecting to payment…')
    track('checkout_redirect', { is_pro: isPro ? '1' : '0', days: String(days) })

    await goPayOrProBypass(meta.code)
  } catch (e: any) {
    const msg = e?.message ?? 'Something went wrong.'
    setStatus(msg)

    track('generate_link_failed', {
      error: msg.slice(0, 120),
      // “mejor esfuerzo” para saber en qué parte explotó
      step: status.includes('Uploading') ? 'upload' : status.includes('Creating') ? 'create_link' : 'unknown',
    })

    setBusy(false)
  }
}
      const primaryLabel = busy ? 'Working…' : isPro ? 'Generate link (Pro)' : `Pay ${priceLabel} & generate link`

      // ✅ typed styles (fix TS complaining about computed styles)
      const pageStyle: CSSProperties = { ...styles.page, padding: isMobile ? 14 : 24 }
      const headerStyle: CSSProperties = { ...styles.header, flexDirection: isMobile ? 'column' : 'row' }
      const accountStyle: CSSProperties = { ...styles.account, width: isMobile ? '100%' : 400 }
      const gridStyle: CSSProperties = {
        ...styles.grid,
        gridTemplateColumns: isMobile ? '1fr' : '1.25fr 0.75fr',
      }
      const controlsRowStyle: CSSProperties = {
        ...styles.controlsRow,
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      }
      const actionsStyle: CSSProperties = {
        ...styles.accountActions,
        justifyContent: isMobile ? 'flex-start' : 'flex-end',
      }

      return (
        <main style={pageStyle}>
          <div style={styles.container}>
            <header style={headerStyle}>
              {/* LEFT: Hero */}
              <div style={styles.hero}>
                <div style={styles.brandRow}>
                  <div style={styles.logoDot} />
                  <div style={styles.brandLabel}>FilePay</div>

                  <span
                    style={{
                      ...styles.badge,
                      ...(isPro ? styles.badgePro : styles.badgeFree),
                    }}
                    title={planBadge}
                  >
                    {planBadge}
                  </span>
                </div>

                <h1 style={{ ...styles.h1, fontSize: isMobile ? 28 : 40,lineHeight: 1.15,marginBottom: 12,}}>
                Create paid download links for your files.
                </h1>

                <p style={{ ...styles.subtitle, maxWidth: 720 }}>
                Upload a file, choose how long the link stays active, pay once, and share it with anyone.
                Recipients don’t need an account.
                </p>

                <div
            style={{
            ...styles.heroBullets,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}
    >
            <div style={styles.heroBullet}>✅ You set duration & price</div>
            <div style={styles.heroBullet}>💳 Pay once, generate link</div>
            <div style={styles.heroBullet}>⏳ Link expires automatically</div>
            </div>

                <div style={styles.trustRow2}>
                  <span style={styles.trustPill}>Secure payments via Stripe</span>
                  <span style={styles.trustPill}>Files stored on Supabase</span>
                  <span style={styles.trustPill}>Auto-expiring links</span>
                </div>
              </div>

              {/* RIGHT: Account */}
              <div style={accountStyle}>
                {userEmail ? (
                  <>
                    <div style={styles.accountTop}>
                      <div style={styles.accountLine}>
                        Signed in as <b>{userEmail}</b>
                      </div>

                      <div style={actionsStyle}>
                        <a href="/pricing" style={styles.linkBtn}>
                          Pricing
                        </a>
                        <a href="/billing" style={styles.linkBtn}>
                          Manage
                        </a>
                        <button type="button" onClick={signOut} style={styles.linkBtn} disabled={busy}>
                          Sign out
                        </button>
                      </div>
                    </div>

                    <div style={styles.accountHint}>
                      {isPro ? 'Pro: links finalize instantly (no per-link checkout).' : 'Tip: Pro skips checkout every time.'}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.accountLine}>
                      <b>Sign in</b> to manage your subscription (optional).
                    </div>

                    <div style={{ ...styles.authRow, flexDirection: isMobile ? 'column' : 'row' }}>
                      <input
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="you@example.com"
                        style={styles.input}
                        disabled={busy}
                        inputMode="email"
                      />
                      <button type="button" onClick={signInWithEmail} style={styles.primaryBtnSmall} disabled={busy}>
                        Sign in
                      </button>
                    </div>

                    {authStatus && <div style={styles.hint}>{authStatus}</div>}

                    <div style={{ ...styles.accountActions, justifyContent: 'flex-start' }}>
                      <a href="/pricing" style={styles.linkBtn}>
                        View pricing
                      </a>
                    </div>
                  </>
                )}
              </div>
            </header>

            <div style={gridStyle}>
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.cardTitle}>Create a download link</div>
                    <div style={styles.cardDesc}>Choose duration, upload your file, then generate a link.</div>
                  </div>

                  <div style={styles.pricePill}>
                    {isPro ? (
                      <>
                        <span style={{ fontWeight: 950 }}>Pro</span> includes this
                      </>
                    ) : (
                      <>
                        <span style={{ fontWeight: 950 }}>{priceLabel}</span> for {formatDays(days)}
                      </>
                    )}
                  </div>
                </div>

                <div style={styles.body}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                  onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setPickedFile(f)

                  if (f) {
                  track('file_selected', {
                  name: f.name,
                  size_mb: Math.round(f.size / 1024 / 1024),
                  type: f.type || 'unknown',
                  })
                  }
        }}
                    disabled={busy}
                  />

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
                    <div style={{ ...styles.dropTop, flexDirection: isMobile ? 'column' : 'row' }}>
                      <div style={styles.dropIcon}>⬆️</div>
                      <div>
                        <div style={styles.dropTitle}>{file ? 'File selected' : 'Drop a file here'}</div>
                        <div style={styles.dropSub}>
                          {file
                            ? `${fileMeta?.name} · ${fileMeta?.size} · ${fileMeta?.type}`
                            : 'or click to browse (PNG, JPG, PDF, ZIP, etc.)'}
                        </div>
                      </div>
                    </div>

                    {file && (
                      <div style={{ ...styles.dropActions, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
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

                  <div style={controlsRowStyle}>
                    <div style={styles.field}>
                      <div style={styles.label}>Link duration</div>
                      <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={busy} style={styles.select}>
                        {DAY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {formatDays(d)}
                          </option>
                        ))}
                      </select>

                      <div style={styles.hint}>
                        {isPro ? (
                          <>Included in Pro.</>
                        ) : (
                          <>
                            Price updates by duration: <b>{priceLabel}</b>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={styles.field}>
  {/* Legal acceptance */}
<div style={{ marginTop: 14 }}>
  <label
  style={{
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)', // 👈 importante para fondo oscuro
    lineHeight: 1.4,
  }}
>
  <input
    type="checkbox"
    checked={accepted}
    onChange={(e) => {
  const v = e.target.checked
  setAccepted(v)
  track('tos_accept_toggle', { accepted: v ? '1' : '0' })
}}
    style={{ marginTop: 3 }}
  />

  <span>
    I agree to the{' '}
    <a href="/terms" target="_blank" style={{ color: '#93c5fd', textDecoration: 'underline' }}>
      Terms of Service
    </a>{' '}
    and{' '}
    <a href="/privacy" target="_blank" style={{ color: '#93c5fd', textDecoration: 'underline' }}>
      Privacy Policy
    </a>
  </span>
</label>
</div>
  <div style={styles.label}>Action</div>

<button
  type="button"
  onClick={handleCreateLink}
  disabled={!canGenerate}
  title={
    !file
      ? 'Select a file first'
      : !accepted
      ? 'Please accept the Terms & Privacy to continue'
      : busy
      ? 'Working...'
      : ''
  }
  style={{
    ...styles.primaryBtn,
    opacity: canGenerate ? 1 : 0.6,
    cursor: canGenerate ? 'pointer' : 'not-allowed',
    width: '100%',
  }}
>
  {primaryLabel}
</button>

{!accepted && file && (
  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
    To generate a link, please accept{' '}
    <a href="/terms" target="_blank" rel="noreferrer">Terms</a> &{' '}
    <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a>.
  </div>
)}
</div>
                  </div>

                  <div style={styles.previewWrap}>
                    <div style={styles.previewHeader}>
                      <div style={styles.previewTitle}>Preview</div>
                      {fileMeta && <div style={styles.previewMeta}>{fileMeta.isImage ? 'Image' : 'File'} · {prettyBytes(fileMeta.sizeBytes)}</div>}
                    </div>

                    <div style={styles.previewBox}>
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl} alt="preview" style={styles.previewImg} />
                      ) : (
                        <div style={styles.previewEmpty}>
                          {file ? (fileMeta?.isImage ? 'Preview unavailable.' : 'No preview for this file type.') : 'Select an image to see a preview here.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {status && <div style={styles.statusBox}>{status}</div>}
                </div>
              </section>

              <aside style={styles.sideCard}>
                <div style={styles.sideTitle}>How it works</div>

                <Step n="1" title="Upload" text="Pick a file from your device." />
                <Step n="2" title="Set duration" text="Choose how long the download link stays available." />
                <Step n="3" title={isPro ? 'Pro' : 'Payment'} text={isPro ? 'Instant — no checkout needed.' : 'Pay once to unlock the download link.'} />
                <Step n="4" title="Share" text="Send the link to anyone — it works until it expires." />

                <div style={styles.divider} />

                {!isPro ? (
                  <div style={styles.ctaCard}>
                    <div style={{ fontWeight: 950 }}>Skip checkout every time</div>
                    <div style={styles.ctaText}>Go Pro ($9/mo) to create unlimited links without per-link payments.</div>
                    <a href="/pricing" style={styles.ctaBtn}>
                      Upgrade to Pro →
                    </a>
                  </div>
                ) : (
                  <div style={styles.ctaCard}>
                    <div style={{ fontWeight: 950 }}>You’re Pro ✅</div>
                    <div style={styles.ctaText}>Links finalize instantly. Manage your subscription anytime.</div>
                    <a href="/billing" style={styles.ctaBtn}>
                      Manage subscription →
                    </a>
                  </div>
                )}
              </aside>
            </div>

     <footer
  style={{
    ...styles.footer,
    textAlign: isMobile ? 'left' : 'center',
    opacity: 0.8,
    fontSize: 14,
  }}
>
  <div>
    Secure download · Expires in <b>{formatDays(days)}</b>
  </div>

  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
    By using FilePay you agree to our{' '}
    <a href="/terms" style={{ textDecoration: 'underline' }}>
      Terms of Service
    </a>{' '}
    and{' '}
    <a href="/privacy" style={{ textDecoration: 'underline' }}>
      Privacy Policy
    </a>
    .
  </div>
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

    const styles: Record<string, CSSProperties> = {
      page: {
        minHeight: '100svh',
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

      hero: {
        flex: 1,
        minWidth: 0,
        paddingRight: 6,
      },

      brandRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 10,
      },
      brandLabel: {
        fontWeight: 950,
        letterSpacing: -0.3,
        opacity: 0.95,
      },

      logoDot: {
        width: 12,
        height: 12,
        borderRadius: 999,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.9))',
        boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
      },

      h1: {
        margin: 0,
        fontWeight: 980,
        letterSpacing: -0.7,
        lineHeight: 1.05,
      },

      subtitle2: {
        margin: '10px 0 0',
        opacity: 0.82,
        maxWidth: 760,
        lineHeight: 1.45,
        fontSize: 13,
      },

      badge: {
        fontSize: 12,
        fontWeight: 950,
        padding: '5px 10px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(0,0,0,0.22)',
      },
      badgePro: { background: 'rgba(124,58,237,0.22)' },
      badgeFree: { background: 'rgba(255,255,255,0.06)' },

      account: {
        width: 400,
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        padding: 14,
      },
      accountTop: { display: 'grid', gap: 10 },
      accountLine: { fontSize: 13, opacity: 0.92, lineHeight: 1.35 },
      accountActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },

      accountHint: {
        marginTop: 10,
        opacity: 0.7,
        fontSize: 12,
        lineHeight: 1.35,
      },

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

      hint: { fontSize: 12, opacity: 0.75, lineHeight: 1.35 },

    heroBullets: {
      marginTop: 12,
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      justifyContent: 'flex-start',
      maxWidth: 720,
      whiteSpace: 'nowrap',
    },
      heroBullet: {
        padding: '7px 10px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(0,0,0,0.22)',
        fontWeight: 850,
      },

      trustRow2: {
        marginTop: 12,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        opacity: 0.78,
        fontSize: 12,
      },
      trustPill: {
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.06)',
        fontWeight: 850,
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
        flexWrap: 'wrap',
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
      dropSub: { marginTop: 4, opacity: 0.78, fontSize: 12, lineHeight: 1.35, wordBreak: 'break-word' },

      dropActions: { marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },

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
        flexWrap: 'wrap',
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