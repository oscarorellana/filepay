export default function Done({ searchParams }: { searchParams: any }) {
  const via = searchParams.via ?? ''
  const mode = searchParams.mode ?? ''

  const found = searchParams.found ?? '0'
  const bytes = searchParams.bytes ?? '0'
  const storage = searchParams.storage ?? '0'
  const hard = searchParams.hard ?? '0'
  const failed = searchParams.failed ?? '0'

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720 }}>
      <h1>Cleanup complete ✅</h1>

      <div style={{ marginTop: 10, opacity: 0.8 }}>
        <div><b>Authorized via:</b> {via || 'unknown'}</div>
        <div><b>Mode:</b> {mode || 'unknown'}</div>
      </div>

      <ul style={{ marginTop: 16, lineHeight: 1.8 }}>
        <li><b>Found:</b> {found}</li>
        <li><b>Total bytes found:</b> {bytes}</li>
        <li><b>Storage deleted:</b> {storage}</li>
        <li><b>Hard deleted (DB):</b> {hard}</li>
        <li><b>Failed:</b> {failed}</li>
      </ul>

      <p style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
        Files were removed from Storage (best effort) and then removed from the DB.
      </p>
    </main>
  )
}