import { createClient } from '@supabase/supabase-js'

type PageProps = {
  params: Promise<{ code: string }>
}

export default async function DownloadPage({ params }: PageProps) {
  const { code } = await params
  const codeParam = code?.trim()

  if (!codeParam) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Link inválido</h1>
        <p>Falta el código.</p>
      </main>
    )
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1) Buscar link por code (TU TABLA NO TIENE slug)
  const { data: link, error: linkErr } = await supabase
    .from('file_links')
    .select('code,file_path,paid,created_by_user_id,created_at')
    .eq('code', codeParam)
    .maybeSingle()

  if (linkErr) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Error DB</h1>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(linkErr, null, 2)}</pre>
      </main>
    )
  }

  if (!link) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Link no encontrado</h1>
        <p>No existe ninguna fila en <code>file_links</code> con:</p>
        <pre>{codeParam}</pre>
        <p style={{ opacity: 0.75 }}>
          Esto significa que el <code>create-link</code> no insertó ese code, o estás probando un code diferente.
        </p>
      </main>
    )
  }

  // 2) Permitir descarga si:
  //    - paid === true
  //    - o el creador del link es Pro activo
  let canDownload = link.paid === true

  if (!canDownload && link.created_by_user_id) {
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('plan,status')
      .eq('user_id', link.created_by_user_id)
      .maybeSingle()

    if (subErr) {
      return (
        <main style={{ padding: 24, fontFamily: 'system-ui' }}>
          <h1>Error leyendo subscription</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(subErr, null, 2)}</pre>
        </main>
      )
    }

    if (sub?.plan === 'pro' && sub?.status === 'active') {
      canDownload = true
    }
  }

  if (!canDownload) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Este link requiere pago</h1>
        <p>Si ya pagaste, vuelve a intentar en unos segundos.</p>
        <pre style={{ opacity: 0.8, marginTop: 12 }}>
          {JSON.stringify({ code: link.code, paid: link.paid }, null, 2)}
        </pre>
      </main>
    )
  }

  // 3) Signed URL para descargar desde bucket "uploads"
  const { data: signed, error: signErr } = await supabase.storage
    .from('uploads')
    .createSignedUrl(link.file_path, 60)

  if (signErr || !signed?.signedUrl) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Error</h1>
        <p>No se pudo generar el link de descarga.</p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(signErr, null, 2)}</pre>
      </main>
    )
  }

  // 4) Redirigir al signed URL (descarga)
  return <meta httpEquiv="refresh" content={`0;url=${signed.signedUrl}`} />
}