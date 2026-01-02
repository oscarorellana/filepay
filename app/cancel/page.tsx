export default function CancelPage() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Pago cancelado ❌</h1>
      <p>No pasó nada. Puedes volver e intentar de nuevo.</p>
      <p style={{ marginTop: 16 }}>
        <a href="/" style={{ textDecoration: 'underline' }}>Volver al inicio</a>
      </p>
    </main>
  )
}