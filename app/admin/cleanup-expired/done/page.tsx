// app/admin/cleanup-expired/done/page.tsx
import Link from 'next/link'

export default function Done({
  searchParams,
}: {
  searchParams: {
    found?: string
    deletedFromStorage?: string
    deletedRows?: string
    failed?: string
  }
}) {
  const found = Number(searchParams.found || 0)
  const deletedFromStorage = Number(searchParams.deletedFromStorage || 0)
  const deletedRows = Number(searchParams.deletedRows || 0)
  const failed = Number(searchParams.failed || 0)

  const nothingToDo = found === 0

  return (
    <main
      style={{
        padding: 32,
        fontFamily: 'system-ui',
        maxWidth: 640,
        margin: '0 auto',
        lineHeight: 1.6,
      }}
    >
      {nothingToDo ? (
        <>
          <h1>All good! 🎉</h1>
          <p>
            There were <b>no expired files</b> to delete.
          </p>
          <p style={{ opacity: 0.8 }}>
            Your storage is clean and everything is up to date.
          </p>
        </>
      ) : (
        <>
          <h1>Cleanup successful ✅</h1>
          <p>
            Expired files were permanently removed.
          </p>

          <ul style={{ marginTop: 16 }}>
            <li>
              <b>Files found:</b> {found}
            </li>
            <li>
              <b>Storage deleted:</b> {deletedFromStorage}
            </li>
            <li>
              <b>Database rows removed:</b> {deletedRows}
            </li>
            {failed > 0 && (
              <li style={{ color: '#b91c1c' }}>
                <b>Failed:</b> {failed}
              </li>
            )}
          </ul>
        </>
      )}

      <div style={{ marginTop: 28 }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            fontWeight: 700,
            color: '#111827',
          }}
        >
          ← Back to FilePay
        </Link>
      </div>
    </main>
  )
}