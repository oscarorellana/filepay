// app/api/download/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type LinkRow = {
  code: string
  file_path: string
  expires_at: string | null
  paid: boolean | null
  deleted_at: string | null
  storage_deleted?: boolean | null
}

function getCodeFromReq(req: Request): string | null {
  const url = new URL(req.url)
  const q = url.searchParams.get('code')
  if (q && q.trim()) return q.trim()

  // soporte opcional: /api/download?code=... (principal)
  // si algún día lo mandas por header:
  const h = req.headers.get('x-filepay-code')
  if (h && h.trim()) return h.trim()

  return null
}

async function lazyDeleteIfExpired(opts: {
  code: string
  file_path: string
  expires_at: string | null
}) {
  const { code, file_path, expires_at } = opts

  const exp = expires_at ? new Date(expires_at).getTime() : NaN
  const isExpired = Number.isFinite(exp) && exp <= Date.now()
  if (!isExpired) return { expired: false }

  const nowIso = new Date().toISOString()

  // 1) Soft delete (idempotente)
  const { data: marked, error: markErr } = await supabaseAdmin
    .from('file_links')
    .update({
      deleted_at: nowIso,
      deleted_reason: 'expired_access',
    })
    .eq('code', code)
    .is('deleted_at', null)
    .select('code')
    .maybeSingle()

  if (markErr) throw new Error(markErr.message)

  // 2) Borrar del storage (best-effort)
  try {
    const { error: delErr } = await supabaseAdmin.storage
      .from('uploads')
      .remove([file_path])

    if (!delErr) {
      await supabaseAdmin
        .from('file_links')
        .update({ storage_deleted: true })
        .eq('code', code)
    }
  } catch {
    // best effort: no rompe
  }

  return { expired: true, justMarked: Boolean(marked) }
}

export async function GET(req: Request) {
  try {
    const code = getCodeFromReq(req)
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    const { data: link, error } = await supabaseAdmin
      .from('file_links')
      .select('code,file_path,expires_at,paid,deleted_at,storage_deleted')
      .eq('code', code)
      .maybeSingle<LinkRow>()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (link.deleted_at) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    // lazy delete si expiró
    const lazy = await lazyDeleteIfExpired({
      code: link.code,
      file_path: link.file_path,
      expires_at: link.expires_at,
    })

    if (lazy.expired) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    // si no está pagado, no se descarga
    if (!link.paid) {
      return NextResponse.json({ error: 'Payment required' }, { status: 402 })
    }

    // Signed URL (60s)
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from('uploads')
      .createSignedUrl(link.file_path, 60)

    if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 })
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: 'Failed to create signed url' }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        code: link.code,
        url: signed.signedUrl,
        expires_in: 60,
      },
      { status: 200 }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Opcional: soporta POST también por si tu frontend lo usa así
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any
    const code = typeof body?.code === 'string' && body.code.trim() ? body.code.trim() : null
    if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

    // Reutiliza lógica llamando internamente a GET con query param
    const url = new URL(req.url)
    url.searchParams.set('code', code)
    const fakeReq = new Request(url.toString(), { method: 'GET', headers: req.headers })
    return GET(fakeReq)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}