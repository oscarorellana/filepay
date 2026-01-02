'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '../lib/supabase-browser'

function safeExt(name: string) {
  const parts = name.split('.')
  if (parts.length < 2) return ''
  const ext = parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext ? `.${ext}` : ''
}

export default function Page() {
  const inputRef = useRef<HTMLInputElement | null>(null)

  // auth
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // file + preview
  const [file, setFile] = useState<File | null>(null)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)

  // backend state
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)

  // user setting
  const [days, setDays] = useState<number>(14)

  // ui state
  const [uploading, setUploading] = useState(false)
  const [creatingLink, setCreatingLink] = useState(false)
  const [creatingCheckout, setCreatingCheckout] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bucket = 'uploads'

  // ---------- Auth: load user + listen to changes ----------
  useEffect(() => {
    const run = async () => {
      const { data } = await supabaseBrowser.auth.getUser()
      setUserEmail(data.user?.email ?? null)
    }

    run()

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabaseBrowser.auth.signOut()
  }

  // ✅ Helper: checks if current signed-in user is Pro
  const isProUser = async (): Promise<boolean> => {
    const { data: userRes } = await supabaseBrowser.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) return false

    const { data, error } = await supabaseBrowser
      .from('subscriptions')
      .select('plan,status')
      .eq('user_id', uid)
      .maybeSingle()

    if (error) {
      console.error('Failed to read subscription', error)
      return false
    }

    return data?.plan === 'pro' && data?.status === 'active'
  }

  // Fix: when navigating back/forward, browsers may restore cached state.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if ((e as any).persisted) {
        setError(null)
        setUploadedPath(null)
        setCode(null)
        setUploading(false)
        setCreatingLink(false)
        setCreatingCheckout(false)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // If duration changes, invalidate old code so it matches the selected duration
  useEffect(() => {
    setCode(null)
  }, [days])

  const pickFile = () => inputRef.current?.click()

  const onFileChosen = (f: File | null) => {
    setError(null)
    setUploadedPath(null)
    setCode(null)

    // release previous preview (important to avoid memory leaks)
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return prev
    })

    setFile(f)

    // keep preview even after upload/clicks
    if (f && f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setLocalPreviewUrl(url)
    } else {
      setLocalPreviewUrl(null)
    }
  }

  const canUpload = useMemo(() => !!file && !uploading, [file, uploading])
  const canPay = useMemo(
    () => !!file && !uploading && !creatingLink && !creatingCheckout,
    [file, uploading, creatingLink, creatingCheckout]
  )

  const uploadToSupabase = async (): Promise<string | null> => {
    if (!file) {
      setError('Pick a file first.')
      return null
    }

    setUploading(true)
    setError(null)

    try {
      const id = crypto.randomUUID()
      const ext = safeExt(file.name)
      const path = `${id}${ext}`

      const { error: upErr } = await supabaseBrowser.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        })

      if (upErr) throw upErr

      setUploadedPath(path)
      return path
    } catch (e: any) {
      console.error(e)
      setError(e?.message ?? 'Upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  const createShortLink = async (filePath: string): Promise<string | null> => {
    setCreatingLink(true)
    setError(null)

    try {
      const res = await fetch('/api/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: filePath,
          file_name: file?.name ?? null,
          file_size: typeof file?.size === 'number' ? file.size : null,
          mime_type: file?.type ?? null,
          days, // respects selection
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()

      if (!json?.code) throw new Error('Missing "code" from /api/create-link')

      setCode(json.code)
      return json.code as string
    } catch (e: any) {
      console.error(e)
      setError(e?.message ?? 'Failed to create link')
      return null
    } finally {
      setCreatingLink(false)
    }
  }

  const payAndGenerateLink = async () => {
    setError(null)

    // 1) ensure upload
    let path = uploadedPath
    if (!path) {
      const uploaded = await uploadToSupabase()
      if (!uploaded) return
      path = uploaded
    }

    // 2) ensure code
    let c = code
    if (!c) {
      const created = await createShortLink(path)
      if (!created) return
      c = created
    }

    // ✅ PRO: skip Stripe checkout
    const pro = await isProUser()
    if (pro) {
      window.location.href = `/success?session_id=pro_${c}`
      return
    }

    // 3) checkout (non-pro)
    setCreatingCheckout(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      })

      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()

      if (!json?.url) throw new Error('Invalid response: missing "url"')

      window.location.href = json.url
    } catch (e: any) {
      console.error(e)
      setError(e?.message ?? 'Failed to open Stripe checkout')
    } finally {
      setCreatingCheckout(false)
    }
  }

  const shareUrl = useMemo(() => {
    if (!code) return null
    if (typeof window === 'undefined') return null
    return `${window.location.origin}/dl/${code}`
  }, [code])

  const priceHint = '$1' // keep simple for now (validation stage)

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
          maxWidth: 980,
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 18,
        }}
      >
        {/* LEFT */}
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            padding: 18,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 26, margin: 0 }}>FilePay</h1>
              <span style={{ opacity: 0.75 }}>Get paid before download</span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
              {userEmail ? (
                <>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>{userEmail}</span>
                  <button
                    type="button"
                    onClick={signOut}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.18)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'white',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <a
                  href="/login"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'white',
                    fontWeight: 900,
                    textDecoration: 'none',
                  }}
                >
                  Sign in
                </a>
              )}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Status: {userEmail ? <>Signed in</> : <>Not signed in</>}
          </div>

          {/* Duration selector */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 900 }}>
              Link duration:
            </div>

            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
              disabled={creatingLink || creatingCheckout || uploading}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                fontWeight: 900,
                outline: 'none',
                cursor: creatingLink || creatingCheckout || uploading ? 'not-allowed' : 'pointer',
              }}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Pro users skip payment.
            </div>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => pickFile()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              onFileChosen(f ?? null)
            }}
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 16,
              border: '1px dashed rgba(255,255,255,0.25)',
              background: 'rgba(0,0,0,0.20)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, opacity: 0.82 }}>Drag & drop a file here</div>
                <div style={{ fontSize: 16, marginTop: 4 }}>
                  {file ? (
                    <>
                      <b>{file.name}</b>{' '}
                      <span style={{ opacity: 0.7 }}>({Math.ceil(file.size / 1024)} KB)</span>
                    </>
                  ) : (
                    <span style={{ opacity: 0.78 }}>or click to select</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  pickFile()
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'white',
                  fontWeight: 800,
                }}
              >
                Choose file
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => onFileChosen(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={uploadToSupabase}
              disabled={!canUpload}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.18)',
                background: !canUpload ? 'rgba(255,255,255,0.06)' : 'rgba(72, 118, 255, 0.35)',
                color: 'white',
                fontWeight: 950,
                cursor: !canUpload ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>

            <button
              type="button"
              onClick={payAndGenerateLink}
              disabled={!canPay}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.18)',
                background: !canPay ? 'rgba(255,255,255,0.06)' : 'rgba(0, 214, 143, 0.35)',
                color: 'white',
                fontWeight: 950,
                cursor: !canPay ? 'not-allowed' : 'pointer',
              }}
            >
              {creatingLink
                ? 'Creating link…'
                : creatingCheckout
                  ? 'Opening Stripe…'
                  : userEmail
                    ? `Generate link`
                    : `Pay ${priceHint} & generate link`}
            </button>

            {uploadedPath && (
              <div style={{ alignSelf: 'center', opacity: 0.78 }}>
                ✅ Uploaded: <code>{uploadedPath}</code>
              </div>
            )}

            {code && (
              <div style={{ alignSelf: 'center', opacity: 0.9 }}>
                🔗 Code: <code>{code}</code>
              </div>
            )}
          </div>

          {shareUrl && (
            <div style={{ marginTop: 12, opacity: 0.92 }}>
              Share link:<br />
              <code>{shareUrl}</code>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                background: 'rgba(255, 72, 72, 0.15)',
                border: '1px solid rgba(255, 72, 72, 0.25)',
              }}
            >
              <b>Error:</b> {error}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>
            Tip: Pro users skip payment. Non-Pro users pay per link until subscriptions are enabled.
          </div>
        </div>

        {/* RIGHT */}
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            padding: 18,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18, opacity: 0.9 }}>Preview</h2>

          <div
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(0,0,0,0.20)',
              minHeight: 260,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {localPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localPreviewUrl}
                alt="Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.7, padding: 14 }}>
                <div style={{ fontSize: 14 }}>Image preview will show here.</div>
                <div style={{ fontSize: 12, marginTop: 6, opacity: 0.8 }}>
                  For non-image files, you’ll only see the filename.
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
            Bucket: <code>{bucket}</code>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            <a href="/pricing" style={{ color: 'white', textDecoration: 'underline' }}>
              View pricing
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}