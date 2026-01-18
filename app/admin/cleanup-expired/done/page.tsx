// app/admin/cleanup-expired/done/page.tsx
export default function Done({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const get = (k: string) => {
    const v = searchParams[k]
    return Array.isArray(v) ? v[0] : v
  }

  const via = get('via') ?? 'unknown'
  const mode = get('mode') ?? 'unknown'
  const dry = get('dryRun') ?? '0'

  const found = get('found') ?? '0'
  const totalBytesHuman = get('totalBytesFoundHuman') ?? ''
  const softDeleted = get('softDeleted') ?? '0'
  const deletedFromStorage = get('deletedFromStorage') ?? '0'
  const deletedRows = get('deletedRows') ?? '0'
  const failed = get('failed') ?? '0'

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720 }}>
      <h1>{dry === '1' ? 'Dry run complete ✅' : 'Cleanup complete ✅'}</h1>

      <div style={{ marginTop: 10, opacity: 0.85 }}>
        <div>
          <b>Authorized via:</b> {via}
        </div>
        <div>
          <b>Mode:</b> {mode}
        </div>
      </div>

      <ul style={{ marginTop: 16, lineHeight: 1.8 }}>
        <li>
          <b>Found:</b> {found}
          {totalBytesHuman ? ` (${totalBytesHuman})` : ''}
        </li>
        <li>
          <b>Soft deleted:</b> {softDeleted}
        </li>
        <li>
          <b>Storage deleted:</b> {deletedFromStorage}
        </li>
        <li>
          <b>Hard deleted (DB):</b> {deletedRows}
        </li>
        <li>
          <b>Failed:</b> {failed}
        </li>
      </ul>

      <p style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
        Storage deletion is best effort; DB rows are deleted only after storage_deleted=true.
      </p>

      <a href="/" style={{ display: 'inline-block', marginTop: 12 }}>
        ← Back to FilePay
      </a>
    </main>
  )
}