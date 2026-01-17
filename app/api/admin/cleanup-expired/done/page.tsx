export default function Done({ searchParams }: { searchParams: any }) {
  const soft = searchParams.soft ?? '0'
  const storage = searchParams.storage ?? '0'
  const hard = searchParams.hard ?? '0'

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Cleanup complete ✅</h1>
      <ul>
        <li>Soft deleted: {soft}</li>
        <li>Storage deleted: {storage}</li>
        <li>Hard deleted (DB): {hard}</li>
      </ul>
    </main>
  )
}