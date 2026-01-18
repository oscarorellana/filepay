// app/admin/cleanup-expired/page.tsx
import { verifyAdminActionToken } from '@/lib/admin-action'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Row = {
  code: string
  expires_at: string | null
  file_bytes: string | number | null // bigint suele venir como string
  file_path: string | null
  paid: boolean | null
  deleted_at: string | null
  storage_deleted: boolean | null
}

function toInt(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.floor(v) : 0
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function bytesToHuman(n: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export default async function Page({
  searchParams,
}: {
  searchParams: { token?: string; include_not_marked?: string; limit?: string }
}) {
  const token = (searchParams.token || '').trim()
  const ok = token && verifyAdminActionToken(token)

  if (!ok) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Unauthorized</h1>
        <p>This link is invalid or expired.</p>
      </main>
    )
  }

  const includeNotMarked = searchParams.include_not_marked === '1'
  const limitRaw = Number(searchParams.limit || '200')
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200

  const nowIso = new Date().toISOString()

  // --- DRY RUN / PREVIEW (no borra nada) ---
  let q = supabaseAdmin
    .from('file_links')
    .select('code,expires_at,file_bytes,file_path,paid,deleted_at,storage_deleted')
    .lte('expires_at', nowIso)
    .order('expires_at', { ascending: true })
    .limit(limit)

  // modo seguro: solo los que YA fueron soft-deleted (deleted_at NOT NULL)
  if (!includeNotMarked) {
    q = q.not('deleted_at', 'is', null)
  }

  const { data, error } = await q
  const rows = (data ?? []) as Row[]

  const found = rows.length
  const totalBytesFound = rows.reduce((acc, r) => acc + toInt(r.file_bytes), 0)

  const softDeletedCount = rows.reduce((acc, r) => acc + (r.deleted_at ? 1 : 0), 0)
  const alreadyStorageDeletedCount = rows.reduce((acc, r) => acc + (r.storage_deleted ? 1 : 0), 0)

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
        <h1>Preview failed</h1>
        <p style={{ color: '#b91c1c' }}>{error.message}</p>
      </main>
    )
  }

  const baseUrl = `/admin/cleanup-expired?token=${encodeURIComponent(token)}`
  const toggleUrl = includeNotMarked ? baseUrl : `${baseUrl}&include_not_marked=1`
  const safeUrl = baseUrl // include_not_marked off
  const limitUrl = `${baseUrl}${includeNotMarked ? '&include_not_marked=1' : ''}&limit=${limit}`

  const actionUrl = `/api/admin/cleanup-expired?token=${encodeURIComponent(token)}${
    includeNotMarked ? '&include_not_marked=1' : ''
  }`

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
            <b>Mode:</b>{' '}
            {includeNotMarked ? 'expired_any (includes not soft-deleted)' : 'expired_soft_deleted_only (safer)'}
          </div>
          <div>
            <b>Found:</b> {found}
          </div>
          <div>
            <b>Total size:</b> {bytesToHuman(totalBytesFound)}
          </div>
          <div>
            <b>Soft-deleted in DB:</b> {softDeletedCount}
          </div>
          <div>
            <b>Already marked storage_deleted:</b> {alreadyStorageDeletedCount}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Limit: {limit} (you can change it via <code>&limit=</code>)
          </div>
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
            href={limitUrl}
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

      <h2 style={{ marginTop: 18 }}>Top expired (preview)</h2>

      {found === 0 ? (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid #e5e7eb' }}>
          ✅ Nothing to delete right now.
        </div>
      ) : (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Showing up to {limit} rows. (This is only a preview.)
          </div>

          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.45 }}>
            {rows
              .slice(0, Math.min(rows.length, limit))
              .map((r) => {
                const b = toInt(r.file_bytes)
                return `${r.code} · exp ${r.expires_at} · ${bytesToHuman(b)} · paid=${String(
                  r.paid
                )} · deleted_at=${r.deleted_at ? 'yes' : 'no'} · storage_deleted=${String(!!r.storage_deleted)}`
              })
              .join('\n')}
          </pre>
        </div>
      )}

      {/* CONFIRM */}
      <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: '1px solid #fee2e2', background: '#fff1f2' }}>
        <h3 style={{ margin: 0 }}>Confirm delete</h3>
        <p style={{ marginTop: 8, marginBottom: 12 }}>
          If you continue, FilePay will attempt to delete the expired files from <b>Supabase Storage</b> and then remove rows
          from the <b>file_links</b> table (only where <code>storage_deleted=true</code>).
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

          <a
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
          </a>
        </form>

        <p style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Tip: Use safer mode first (only soft-deleted). If everything looks right, you can switch to “include not soft-deleted”.
        </p>
      </div>
    </main>
  )
}