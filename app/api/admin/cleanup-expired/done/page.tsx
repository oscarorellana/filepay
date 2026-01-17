// app/api/admin/cleanup-expired/done/page.tsx

export default function Done({ searchParams }: { searchParams: any }) {
  const soft = String(searchParams?.soft ?? '0')
  const storage = String(searchParams?.storage ?? '0')
  const hard = String(searchParams?.hard ?? '0')

  // opcionales (si luego los mandas en la URL)
  const found = searchParams?.found != null ? String(searchParams.found) : null
  const failed = searchParams?.failed != null ? String(searchParams.failed) : null
  const via = searchParams?.via != null ? String(searchParams.via) : null
  const mode = searchParams?.mode != null ? String(searchParams.mode) : null

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 12px' }}>Cleanup complete ✅</h1>

      <p style={{ margin: '0 0 16px', color: '#374151' }}>
        The cleanup action finished. Here’s what happened:
      </p>

      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        <li>
          <b>Soft deleted:</b> {soft}
        </li>
        <li>
          <b>Storage deleted:</b> {storage}
        </li>
        <li>
          <b>Hard deleted (DB):</b> {hard}
        </li>

        {found !== null && (
          <li>
            <b>Found:</b> {found}
          </li>
        )}

        {failed !== null && (
          <li>
            <b>Failed:</b> {failed}
          </li>
        )}

        {via !== null && (
          <li>
            <b>Authorized via:</b> {via}
          </li>
        )}

        {mode !== null && (
          <li>
            <b>Mode:</b> {mode}
          </li>
        )}
      </ul>

      <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a
          href="/admin/cleanup-expired"
          style={{
            display: 'inline-block',
            padding: '10px 12px',
            borderRadius: 10,
            background: '#111827',
            color: 'white',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Back to cleanup page
        </a>

        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            background: 'white',
            color: '#111827',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Home
        </a>
      </div>
    </main>
  )
}