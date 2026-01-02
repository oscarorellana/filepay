export default function PricingPage() {
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
      <div style={{ width: '100%', maxWidth: 980 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 34 }}>Pricing</h1>
            <p style={{ marginTop: 8, opacity: 0.82, maxWidth: 680, lineHeight: 1.55 }}>
              FilePay lets you <b>get paid before your file is downloaded</b>. Perfect for freelancers delivering work fast.
            </p>
          </div>

          <a
            href="/"
            style={{
              textDecoration: 'none',
              color: 'white',
              opacity: 0.92,
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              fontWeight: 850,
            }}
          >
            ← Back
          </a>
        </div>

        {/* Plans */}
        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          {/* Starter */}
          <div
            style={{
              borderRadius: 18,
              padding: 18,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ opacity: 0.82, fontWeight: 850 }}>Starter</div>
            <div style={{ fontSize: 36, fontWeight: 950, marginTop: 8 }}>
              $9<span style={{ fontSize: 14, opacity: 0.82 }}>/month</span>
            </div>

            <ul style={{ marginTop: 14, paddingLeft: 18, opacity: 0.92, lineHeight: 1.9 }}>
              <li>10 links / month</li>
              <li>Time-limited links</li>
              <li>Basic support</li>
            </ul>

            <div style={{ marginTop: 14, opacity: 0.72, fontSize: 12 }}>
              Best if you only deliver a few files per month.
            </div>

            <button
              disabled
              style={{
                marginTop: 14,
                width: '100%',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                fontWeight: 950,
                cursor: 'not-allowed',
                opacity: 0.85,
              }}
              title="We’ll enable this when subscriptions are live"
            >
              Coming soon
            </button>
          </div>

          {/* Pro (highlight) */}
          <div
            style={{
              borderRadius: 18,
              padding: 18,
              background: 'rgba(0, 214, 143, 0.10)',
              border: '1px solid rgba(0, 214, 143, 0.30)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                fontSize: 12,
                fontWeight: 950,
                padding: '6px 10px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(0,0,0,0.25)',
              }}
            >
              Most popular
            </div>

            <div style={{ opacity: 0.95, fontWeight: 950 }}>Pro</div>
            <div style={{ fontSize: 36, fontWeight: 950, marginTop: 8 }}>
              $29<span style={{ fontSize: 14, opacity: 0.85 }}>/month</span>
            </div>

            <ul style={{ marginTop: 14, paddingLeft: 18, opacity: 0.96, lineHeight: 1.9 }}>
              <li>50 links / month</li>
              <li>Link history</li>
              <li>Faster delivery workflow</li>
              <li>Designed for freelancers</li>
            </ul>

            <div style={{ marginTop: 14, opacity: 0.82, fontSize: 12 }}>
              If you deliver weekly, Pro usually pays for itself.
            </div>

            <button
              disabled
              style={{
                marginTop: 14,
                width: '100%',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(0, 214, 143, 0.35)',
                color: 'white',
                fontWeight: 950,
                cursor: 'not-allowed',
                opacity: 0.95,
              }}
              title="We’ll enable this when subscriptions are live"
            >
              Upgrade to Pro (coming soon)
            </button>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.78 }}>
              For now, you can still use pay-per-link from the homepage.
            </div>
          </div>

          {/* Agency */}
          <div
            style={{
              borderRadius: 18,
              padding: 18,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ opacity: 0.82, fontWeight: 850 }}>Agency</div>
            <div style={{ fontSize: 36, fontWeight: 950, marginTop: 8 }}>
              $79<span style={{ fontSize: 14, opacity: 0.82 }}>/month</span>
            </div>

            <ul style={{ marginTop: 14, paddingLeft: 18, opacity: 0.92, lineHeight: 1.9 }}>
              <li>Unlimited links</li>
              <li>Branding (soon)</li>
              <li>Priority support</li>
            </ul>

            <div style={{ marginTop: 14, opacity: 0.72, fontSize: 12 }}>
              Great for small teams and agencies.
            </div>

            <button
              disabled
              style={{
                marginTop: 14,
                width: '100%',
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                fontWeight: 950,
                cursor: 'not-allowed',
                opacity: 0.85,
              }}
              title="We’ll enable this when subscriptions are live"
            >
              Coming soon
            </button>
          </div>
        </div>

        {/* Pay-per-link CTA */}
        <div
          style={{
            marginTop: 18,
            borderRadius: 18,
            padding: 16,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 950 }}>Not ready for a subscription?</div>
            <div style={{ opacity: 0.82, marginTop: 4 }}>
              Use FilePay pay-per-link: upload, pay, and share in seconds.
            </div>
          </div>

          <a
            href="/"
            style={{
              textDecoration: 'none',
              color: 'white',
              fontWeight: 950,
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(72, 118, 255, 0.35)',
            }}
          >
            Create a link
          </a>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
          Subscriptions are coming soon. Until then, FilePay works as pay-per-link with time-limited access.
        </div>
      </div>
    </main>
  )
}