// app/admin/cleanup-expired/page.tsx
import { redirect } from 'next/navigation'
import { verifyAdminActionToken } from '@/lib/admin-action'

export default async function Page({
  searchParams,
}: {
  searchParams: { token?: string; limit?: string }
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

  async function doCleanup() {
    'use server'

    // puedes ajustar limit si quieres (default del route es 200)
    const limit = (searchParams.limit || '').trim()
    const qs = new URLSearchParams()
    qs.set('token', token)
    if (limit) qs.set('limit', limit)

    // Importante: el route acepta token por query
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/cleanup-expired?${qs}`, {
      method: 'POST',
      cache: 'no-store',
    })

    const json = (await res.json().catch(() => ({}))) as any

    if (!res.ok) {
      const msg = json?.error || 'Cleanup failed'
      redirect(`/admin/cleanup-expired/done?soft=0&storage=0&hard=0&error=${encodeURIComponent(msg)}`)
    }

    // Tu route devuelve: deletedFromStorage, deletedRows, etc.
    const storage = String(json?.deletedFromStorage ?? 0)
    const hard = String(json?.deletedRows ?? 0)

    // “soft” aquí realmente no aplica porque este endpoint hace hard delete;
    // lo dejo en 0 para que no confunda
    redirect(`/admin/cleanup-expired/done?soft=0&storage=${storage}&hard=${hard}`)
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720 }}>
      <h1>Delete expired files</h1>
      <p>
        This will permanently delete <b>expired files</b> from storage and remove their DB rows.
      </p>

      <form action={doCleanup}>
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