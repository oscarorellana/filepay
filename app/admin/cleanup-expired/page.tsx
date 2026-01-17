'use client'

import { useMemo, useState } from 'react'

export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  const token = (searchParams.token || '').trim()

  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>('')

  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams()
    qs.set('token', token)
    qs.set('include_not_marked', '1') // ✅ borra expirados aunque deleted_at sea null
    qs.set('limit', '200')
    return `/api/admin/cleanup-expired?${qs.toString()}`
  }, [token])

  async function runCleanup() {
    if (!token) {
      setMsg('Unauthorized: missing token.')
      return
    }
    if (!confirm) {
      setMsg('Please confirm first.')
      return
    }

    setBusy(true)
    setMsg('Running cleanup…')

    try {
      const res = await fetch(apiUrl, { method: 'POST' })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMsg(json?.error || 'Cleanup failed.')
        setBusy(false)
        return
      }

      // manda a /admin/cleanup-expired/done con stats
      const done = new URLSearchParams()
      done.set('via', json.via ?? '')
      done.set('mode', json.mode ?? '')
      done.set('found', String(json.found ?? 0))
      done.set('bytes', String(json.totalBytesFound ?? 0))
      done.set('storage', String(json.deletedFromStorage ?? 0))
      done.set('hard', String(json.deletedRows ?? 0))
      done.set('failed', String(json.failed ?? 0))
      window.location.href = `/admin/cleanup-expired/done?${done.toString()}`
    } catch (e: any) {
      setMsg(e?.message || 'Cleanup error.')
      setBusy(false)
    }
  }

  if (!token) {
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
        This will permanently delete <b>all expired files</b> from Supabase Storage and remove their rows from the DB.
      </p>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            disabled={busy}
          />
          <span style={{ fontWeight: 700 }}>
            Yes — I understand this is permanent and will delete expired files now.
          </span>
        </label>

        <button
          type="button"
          onClick={runCleanup}
          disabled={!confirm || busy}
          style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #111827',
            background: '#111827',
            color: 'white',
            fontWeight: 800,
            cursor: !confirm || busy ? 'not-allowed' : 'pointer',
            opacity: !confirm || busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Deleting…' : 'Delete all expired now'}
        </button>

        {msg && <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>{msg}</div>}

        <p style={{ marginTop: 10, color: '#6b7280', fontSize: 12 }}>
          Token expires soon. If it fails, open the latest report email again.
        </p>
      </div>
    </main>
  )
}