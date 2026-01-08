import { createClient } from '@supabase/supabase-js'

type PageProps = {
  params: Promise<{ code: string }>
}

export default async function DownloadPage({ params }: PageProps) {
  const { code } = await params
  const codeParam = (code ?? '').trim()

  if (!codeParam) {
    return (
      <Shell title="Invalid link" subtitle="Missing download code.">
        <Hint>Go back and request a new link.</Hint>
        <Actions />
      </Shell>
    )
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1) Load link record (NO slug — only code)
  const { data: link, error: linkErr } = await supabase
    .from('file_links')
    .select('code,file_path,paid,created_by_user_id,expires_at,created_at')
    .eq('code', codeParam)
    .maybeSingle()

  if (linkErr) {
    return (
      <Shell title="Database error" subtitle="We couldn't load this link right now.">
        <CodeBlock value={linkErr.message} />
        <Actions />
      </Shell>
    )
  }

  if (!link) {
    return (
      <Shell title="Link not found" subtitle="This download code does not exist.">
        <Hint>Code: <b>{codeParam}</b></Hint>
        <Actions />
      </Shell>
    )
  }

  // 2) Expiration
  if (link.expires_at) {
    const exp = new Date(link.expires_at)
    const expired = new Date() >= exp
    if (expired) {
      return (
        <Shell title="Link expired ⌛" subtitle="This link is no longer active.">
          <Hint>
            Expired at: <b>{exp.toLocaleString()}</b>
          </Hint>
          <Actions />
        </Shell>
      )
    }
  }

  // 3) Access control: paid OR creator is Pro active
  let canDownload = link.paid === true

  if (!canDownload && link.created_by_user_id) {
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('plan,status')
      .eq('user_id', link.created_by_user_id)
      .maybeSingle()

    if (subErr) {
      return (
        <Shell title="Subscription check failed" subtitle="Try again in a moment.">
          <CodeBlock value={subErr.message} />
          <Actions />
        </Shell>
      )
    }

    if (sub?.plan === 'pro' && sub?.status === 'active') {
      canDownload = true
    }
  }

  if (!canDownload) {
    return (
      <Shell
        title="Payment required"
        subtitle="This link requires payment before download."
      >
        <Hint>
          If you already paid, refresh in a few seconds and try again.
        </Hint>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <a href="" style={styles.primaryBtn}>
            Refresh
          </a>
          <a href="/" style={styles.secondaryBtn}>
            Go to home
          </a>
        </div>

        <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>
          Code: <code style={styles.inlineCode}>{link.code}</code> · paid:{' '}
          <code style={styles.inlineCode}>{String(link.paid)}</code>
        </div>
      </Shell>
    )
  }

  // 4) Signed URL (bucket uploads)
  const { data: signed, error: signErr } = await supabase.storage
    .from('uploads')
    .createSignedUrl(link.file_path, 60)

  if (signErr || !signed?.signedUrl) {
    return (
      <Shell title="Download error" subtitle="We couldn't generate the download URL.">
        <Hint>
          File path: <code style={styles.inlineCode}>{link.file_path}</code>
        </Hint>
        <CodeBlock value={signErr?.message ?? 'Missing signed URL'} />
        <Actions />
      </Shell>
    )
  }

  // 5) Redirect to signed URL
  return (
  <Shell title="Your download is ready ✅" subtitle="Click to start the download.">
    <Hint>For security, this download link expires in ~60 seconds.</Hint>

    <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <a href={signed.signedUrl} style={styles.primaryBtn}>
        Download now
      </a>
      <a href="/" style={styles.secondaryBtn}>
        Go to home
      </a>
    </div>
  </Shell>
)
}

function Actions() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
      <a href="/" style={styles.primaryBtn}>Go to home</a>
      <a href="" style={styles.secondaryBtn}>Refresh</a>
    </div>
  )
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoDot} />
          <div>
            <h1 style={styles.h1}>{title}</h1>
            <p style={styles.p}>{subtitle}</p>
          </div>
        </div>

        <div style={styles.body}>{children}</div>
      </div>
    </main>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={styles.hint}>{children}</div>
}

function CodeBlock({ value }: { value: string }) {
  return (
    <pre style={styles.pre}>
      {value}
    </pre>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.20), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.18), transparent 55%), #07070a',
    color: 'white',
  },
  card: {
    width: 'min(720px, 100%)',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    padding: 16,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logoDot: {
    width: 12,
    height: 12,
    marginTop: 6,
    borderRadius: 999,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.9))',
  },
  h1: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: -0.2 },
  p: { margin: '6px 0 0', opacity: 0.78, lineHeight: 1.35, fontSize: 13 },
  body: { padding: 16 },
  hint: {
    fontSize: 13,
    opacity: 0.85,
    lineHeight: 1.45,
  },
  pre: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(0,0,0,0.28)',
    overflowX: 'auto',
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: 'pre-wrap',
  },
  inlineCode: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    padding: '2px 6px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.16)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78))',
    color: '#0b0b10',
    fontWeight: 900,
    textDecoration: 'none',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 850,
    textDecoration: 'none',
  },
}