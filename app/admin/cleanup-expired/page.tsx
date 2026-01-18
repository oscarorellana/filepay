// app/admin/cleanup-expired/page.tsx
import Link from 'next/link'

export const dynamic = 'force-dynamic'
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

function getSiteUrl() {
  const s = (process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (s) return s.replace(/\/+$/, '')
  // local fallback (dev)
  return 'http://localhost:3000'
}

export default async function Page({
  searchParams,
}: {
  searchParams: { token?: string; include_not_marked?: string; limit?: string }
}) {
  const token = (searchParams.token || '').trim()
  const includeNotMarked = searchParams.include_not_marked === '1'
  const limit = (() => {
    const n = Number(searchParams.limit || '200')
    if (!Number.isFinite(n)) return 200
    return Math.min(Math.max(Math.floor(n), 1), 500)
  })()

  if (!token) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Unauthorized</h1>
        <p>Missing token.</p>
        <p style={{ opacity: 0.7, fontSize: 12 }}>Open the latest email report again.</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/" style={{ color: '#111827' }}>
            ← Back to FilePay
          </Link>
        </p>
      </main>
    )
  }

  const siteUrl = getSiteUrl()

  // ✅ Dry-run preview using the API (the API is the source of truth for auth)
  const apiUrl =
    `${siteUrl}/api/admin/cleanup-expired` +
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
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Unauthorized</h1>
        <p>This link is invalid or expired.</p>
        <p style={{ opacity: 0.7, fontSize: 12 }}>Open the latest email report again.</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/" style={{ color: '#111827' }}>
            ← Back to FilePay
          </Link>
        </p>
      </main>
    )
  }

  if (serverError) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
        <h1>Preview failed</h1>
        <p style={{ color: '#b91c1c' }}>{serverError}</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/" style={{ color: '#111827' }}>
            ← Back to FilePay
          </Link>
        </p>
      </main>
    )
  }

  const found = Number(preview?.found || 0)

  const baseUrl = `/admin/cleanup-expired?token=${encodeURIComponent(token)}&limit=${limit}`
  const safeUrl = baseUrl
  const toggleUrl = includeNotMarked ? safeUrl : `${baseUrl}&include_not_marked=1`

  // ✅ Real delete endpoint (NOT dry-run)
  const actionUrl =
    `/api/admin/cleanup-expired?token=${encodeURIComponent(token)}` +
    `&limit=${limit}` +
    (includeNotMarked ? `&include_not_marked=1` : ``)

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>Expired cleanup (preview)</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        This page is a <b>dry run</b>. It does <b>not</b> delete anything until you confirm.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          background: '#f9fafb',
        }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
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
          <div style={{ fontSize: 12, opacity: 0.75 }}>Limit: {limit}</div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={includeNotMarked ? safeUrl : toggleUrl}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #111827',
              background: '#fff',
              color: '#111827',
              textDecoration: 'none',
              fontWeight: 800,
            }}
          >
            {includeNotMarked ? 'Use safer mode (only soft-deleted)' : 'Include not soft-deleted (riskier)'}
          </a>

          <a
            href={includeNotMarked ? toggleUrl : safeUrl}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#111827',
              textDecoration: 'none',
              fontWeight: 800,
            }}
          >
            Refresh
          </a>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: '1px solid #fee2e2', background: '#fff1f2' }}>
        <h3 style={{ margin: 0 }}>Confirm delete</h3>
        <p style={{ marginTop: 8, marginBottom: 12 }}>
          If you continue, FilePay will attempt to delete expired files from <b>Supabase Storage</b> and then remove rows
          from <b>file_links</b> (only after <code>storage_deleted=true</code>).
        </p>

        <form action={actionUrl} method="POST" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="submit"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #111827',
              background: '#111827',
              color: 'white',
              fontWeight: 900,
              cursor: 'pointer',
            }}
            disabled={found === 0}
          >
            Delete expired now
          </button>

          <Link
            href="/"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#111827',
              textDecoration: 'none',
              fontWeight: 900,
            }}
          >
            Cancel
          </Link>
        </form>

        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Tip: Use safer mode first. If everything looks right, switch to “include not soft-deleted”.
        </p>
      </div>
    </main>
  )
}