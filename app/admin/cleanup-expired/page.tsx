// app/admin/cleanup-expired/page.tsx
import { verifyAdminActionToken } from '@/lib/admin-action'

export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token || ''
  const ok = token && verifyAdminActionToken(token)

  if (!ok) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Unauthorized</h1>
        <p>This link is invalid or expired.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720 }}>
      <h1>Delete expired files</h1>
      <p>
        This will permanently delete <b>all expired links</b> from storage (and optionally from DB),
        in one click.
      </p>

      <form action="/api/admin/purge-expired" method="POST">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #111827',
            background: '#111827',
            color: 'white',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Delete all expired now
        </button>
      </form>

      <p style={{ marginTop: 12, color: '#6b7280', fontSize: 12 }}>
        Token expires soon. If it fails, open the latest report email again.
      </p>
    </main>
  )
}