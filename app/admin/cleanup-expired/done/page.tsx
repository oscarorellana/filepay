// app/admin/cleanup-expired/done/page.tsx
export const dynamic = 'force-dynamic'

export default function Done({ searchParams }: { searchParams: any }) {
  const via = searchParams.via ?? ''
  const mode = searchParams.mode ?? ''
  const dry = searchParams.dryRun ?? '0'

  const found = searchParams.found ?? '0'
  const bytes = searchParams.totalBytesFoundHuman ?? searchParams.bytes ?? '0'
  const soft = searchParams.softDeleted ?? searchParams.soft ?? '0'
  const storage = searchParams.deletedFromStorage ?? searchParams.storage ?? '0'
  const hard = searchParams.deletedRows ?? searchParams.hard ?? '0'
  const failed = searchParams.failed ?? '0'

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720 }}>
      <h1>{dry === '1' ? 'Dry run complete ✅' : 'Cleanup complete ✅'}</h1>

      <div style={{ marginTop: 10, opacity: 0.85 }}>
        <div><b>Authorized via:</b> {via || 'unknown'}</div>
        <div><b>Mode:</b> {mode || 'unknown'}</div>
      </div>

      <ul style={{ marginTop: 16, lineHeight: 1.8 }}>
        <li><b>Found:</b> {found}</li>
        <li><b>Total bytes found:</b> {bytes}</li>
        <li><b>Soft deleted:</b> {soft}</li>
        <li><b>Storage deleted:</b> {storage}</li>
        <li><b>Hard deleted (DB):</b> {hard}</li>
        <li><b>Failed:</b> {failed}</li>
      </ul>

      <p style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
        {dry === '1'
          ? 'No files were deleted. This was a preview only.'
          : 'Storage deletion is best effort; DB rows are deleted only after storage_deleted=true.'}
      </p>

      <a href="/" style={{ display: 'inline-block', marginTop: 14, fontWeight: 800 }}>
        ← Back to FilePay
      </a>
    </main>
  )
}