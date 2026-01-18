// app/admin/cleanup-expired/page.tsx
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

type ApiPayload = {
  ok?: boolean
  error?: string

  dryRun?: boolean
  via?: string
  mode?: string
  limit?: number

  found?: number
  totalBytesFound?: number
  totalBytesFoundHuman?: string

  softDeleted?: number
  deletedFromStorage?: number
  deletedRows?: number
  failed?: number

  failures?: Array<{ code: string; file_path: string; error: string }>
}

// ✅ soporta searchParams como object o Promise (Next 15)
async function resolveSearchParams(sp: any): Promise<Record<string, any>> {
  const v = await Promise.resolve(sp ?? {})
  return v && typeof v === 'object' ? v : {}
}

function pickFirstString(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}

function getBaseUrlFromEnv(): string | null {
  const s = (process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (!s) return null
  return s.replace(/\/+$/, '')
}

const ui = {
  page: {
    minHeight: '100svh',
    padding: 24,
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    color: '#fff',
    background:
      'radial-gradient(1200px 600px at 18% 0%, rgba(124,58,237,0.26), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(59,130,246,0.22), transparent 55%), #07070a',
  } as const,

  container: { maxWidth: 920, margin: '0 auto' } as const,

  card: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
  } as const,

  cardDanger: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(248,113,113,0.35)',
    background: 'rgba(248,113,113,0.10)',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
  } as const,

  muted: { opacity: 0.78 } as const,
  tiny: { fontSize: 12, opacity: 0.72 } as const,

  btn: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    textDecoration: 'none',
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-block',
  } as const,

  btnPrimary: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    background: '#ffffff',
    color: '#0b0b10',
    textDecoration: 'none',
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  } as const,

  btnDanger: {
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'linear-gradient(135deg, rgba(248,113,113,0.95), rgba(248,113,113,0.78))',
    color: '#0b0b10',
    textDecoration: 'none',
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
  } as const,
}

export default async function Page(props: { searchParams?: any }) {
  const sp = await resolveSearchParams(props.searchParams)

  const token = pickFirstString(sp.token).trim()
  const includeNotMarked = pickFirstString(sp.include_not_marked).trim() === '1'

  const limit = (() => {
    const raw = pickFirstString(sp.limit).trim()
    const n = Number(raw || '200')
    if (!Number.isFinite(n)) return 200
    return Math.min(Math.max(Math.floor(n), 1), 500)
  })()

  if (!token) {
    return (
      <main style={ui.page}>
        <div style={ui.container}>
          <h1 style={{ margin: 0 }}>Unauthorized</h1>
          <p style={{ marginTop: 10 }}>Missing token.</p>
          <p style={ui.tiny}>Open the latest email report again.</p>

          <p style={{ marginTop: 14 }}>
            <Link href="/" style={{ color: '#fff' }}>
              ← Back to FilePay
            </Link>
          </p>
        </div>
      </main>
    )
  }

  const base = getBaseUrlFromEnv()
  if (!base) {
    return (
      <main style={ui.page}>
        <div style={ui.container}>
          <h1 style={{ margin: 0 }}>Preview failed</h1>
          <p style={{ marginTop: 10, color: 'rgba(248,113,113,0.95)' }}>Missing NEXT_PUBLIC_SITE_URL</p>
          <p style={ui.tiny}>Set it in Vercel (example: https://filepay.vercel.app)</p>
          <p style={{ marginTop: 14 }}>
            <Link href="/" style={{ color: '#fff' }}>
              ← Back to FilePay
            </Link>
          </p>
        </div>
      </main>
    )
  }

  const apiUrl =
    `${base}/api/admin/cleanup-expired` +
    `?token=${encodeURIComponent(token)}` +
    `&dry_run=1` +
    `&limit=${limit}` +
    (includeNotMarked ? `&include_not_marked=1` : ``)

  let preview: ApiPayload | null = null
  let unauthorized = false
  let serverError: string | null = null

  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })

    if (res.status === 401) {
      unauthorized = true
    } else {
      const json = (await res.json().catch(() => ({}))) as ApiPayload
      preview = json
      if (!res.ok) serverError = json?.error || `API error (${res.status})`
    }
  } catch (e: any) {
    serverError = e?.message || 'Failed to reach API.'
  }

  if (unauthorized) {
    return (
      <main style={ui.page}>
        <div style={ui.container}>
          <h1 style={{ margin: 0 }}>Unauthorized</h1>
          <p style={{ marginTop: 10 }}>This link is invalid or expired.</p>
          <p style={ui.tiny}>Open the latest email report again.</p>
          <p style={{ marginTop: 14 }}>
            <Link href="/" style={{ color: '#fff' }}>
              ← Back to FilePay
            </Link>
          </p>
        </div>
      </main>
    )
  }

  if (serverError) {
    return (
      <main style={ui.page}>
        <div style={ui.container}>
          <h1 style={{ margin: 0 }}>Preview failed</h1>
          <p style={{ marginTop: 10, color: 'rgba(248,113,113,0.95)' }}>{serverError}</p>
          <pre style={{ marginTop: 12, fontSize: 12, opacity: 0.75, whiteSpace: 'pre-wrap' }}>
            debug apiUrl: {apiUrl}
          </pre>
          <p style={{ marginTop: 14 }}>
            <Link href="/" style={{ color: '#fff' }}>
              ← Back to FilePay
            </Link>
          </p>
        </div>
      </main>
    )
  }

  const found = Number(preview?.found || 0)

  const baseUrl = `/admin/cleanup-expired?token=${encodeURIComponent(token)}&limit=${limit}`
  const safeUrl = baseUrl
  const riskyUrl = `${baseUrl}&include_not_marked=1`

  const actionUrl =
    `/api/admin/cleanup-expired?token=${encodeURIComponent(token)}` +
    `&limit=${limit}` +
    (includeNotMarked ? `&include_not_marked=1` : ``)

  return (
    <main style={ui.page}>
      <div style={ui.container}>
        <h1 style={{ margin: 0, fontWeight: 980, letterSpacing: -0.4 }}>Expired cleanup (preview)</h1>
        <p style={{ marginTop: 10, ...ui.muted }}>
          This page is a <b>dry run</b>. It does <b>not</b> delete anything until you confirm.
        </p>

        <div style={ui.card}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <b>Authorized via:</b> {preview?.via || 'unknown'}
            </div>
            <div>
              <b>Mode:</b>{' '}
              {includeNotMarked ? 'expired_any (includes not soft-deleted)' : 'expired_soft_deleted_only (safer)'}
            </div>
            <div>
              <b>Found:</b> {found}
            </div>
            <div>
              <b>Total size:</b> {preview?.totalBytesFoundHuman || '0 B'}
            </div>
            <div style={ui.tiny}>Limit: {limit}</div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={includeNotMarked ? safeUrl : riskyUrl} style={ui.btn}>
              {includeNotMarked ? 'Use safer mode (only soft-deleted)' : 'Include not soft-deleted (riskier)'}
            </a>

            <a href={includeNotMarked ? riskyUrl : safeUrl} style={ui.btn}>
              Refresh
            </a>
          </div>
        </div>

        <div style={ui.cardDanger}>
          <h3 style={{ margin: 0 }}>Confirm delete</h3>
          <p style={{ marginTop: 10, marginBottom: 12, ...ui.muted }}>
            If you continue, FilePay will attempt to delete expired files from <b>Supabase Storage</b> and then remove rows
            from <b>file_links</b> (only after <code>storage_deleted=true</code>).
          </p>

          <form
            action={actionUrl}
            method="POST"
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <button
              type="submit"
              style={{
                ...ui.btnDanger,
                opacity: found === 0 ? 0.6 : 1,
                cursor: found === 0 ? 'not-allowed' : 'pointer',
              }}
              disabled={found === 0}
            >
              Delete expired now
            </button>

            <Link href="/" style={ui.btnPrimary}>
              Cancel
            </Link>
          </form>

          <p style={{ marginTop: 10, ...ui.tiny }}>
            Tip: Use safer mode first. If everything looks right, switch to “include not soft-deleted”.
          </p>
        </div>
      </div>
    </main>
  )
}