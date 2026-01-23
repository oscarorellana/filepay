'use client'

import { track } from '@vercel/analytics'
import Link from 'next/link'
import { useRef } from 'react'

export default function TrackingCtas(props: { variant?: 'hero' | 'bottom' } = {}) {
  const variant = props.variant ?? 'hero'
  const page = 'wetransfer-alternative'

  // evita doble track por doble click rápido
  const lastTsRef = useRef<number>(0)
  const safeTrack = (cta: string) => {
    const now = Date.now()
    if (now - lastTsRef.current < 500) return
    lastTsRef.current = now
    track('landing_cta_click', { page, cta })
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Link
        href="/"
        onClick={() => safeTrack(`${variant}_open_app`)}
        style={{
          padding: '12px 14px',
          borderRadius: 14,
          textDecoration: 'none',
          fontWeight: 950,
          background: '#7C5CFF',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#070A13',
        }}
      >
        {variant === 'bottom' ? 'Create a link →' : 'Create a secure link →'}
      </Link>

      {variant !== 'bottom' && (
        <Link
          href="/pricing"
          onClick={() => safeTrack(`${variant}_pricing`)}
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            textDecoration: 'none',
            fontWeight: 900,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#E7EAF2',
          }}
        >
          View pricing
        </Link>
      )}
    </div>
  )
}