'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const sendMagicLink = async () => {
    setError(null)

    const e = email.trim().toLowerCase()
    if (!e || !e.includes('@')) {
      setError('Enter a valid email.')
      return
    }

    setStatus('sending')

    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email: e,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setStatus('error')
      return
    }

    setStatus('sent')
  }

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
          maxWidth: 520,
          padding: 18,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>Sign in</h1>
        <p style={{ marginTop: 8, opacity: 0.82, lineHeight: 1.5 }}>
          We’ll email you a magic link. No password needed.
        </p>

        {status === 'sent' ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(0,214,143,0.25)',
              background: 'rgba(0,214,143,0.12)',
            }}
          >
            <b>Check your inbox ✅</b>
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Click the magic link we sent to <code>{email}</code>.
            </div>
          </div>
        ) : (
          <>
            <label style={{ display: 'block', marginTop: 12, opacity: 0.9, fontWeight: 800 }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              style={{
                marginTop: 8,
                width: '100%',
                padding: '12px 12px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                outline: 'none',
                fontSize: 14,
              }}
            />

            <button
              onClick={sendMagicLink}
              disabled={status === 'sending'}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.18)',
                background: status === 'sending' ? 'rgba(255,255,255,0.06)' : 'rgba(72, 118, 255, 0.35)',
                color: 'white',
                fontWeight: 950,
                cursor: status === 'sending' ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: '1px solid rgba(255,72,72,0.25)',
                  background: 'rgba(255,72,72,0.14)',
                }}
              >
                <b>Error:</b> {error}
              </div>
            )}

            <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
              Tip: Check Spam/Promotions if you don’t see it in 1–2 minutes.
            </div>
          </>
        )}

        <div style={{ marginTop: 16, opacity: 0.9 }}>
          <a href="/" style={{ color: 'white', textDecoration: 'underline' }}>
            Back to home
          </a>
        </div>
      </div>
    </main>
  )
}