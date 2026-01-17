import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getBearer(req: Request) {
  const auth = (req.headers.get('authorization') || '').trim()
  if (!auth.toLowerCase().startsWith('bearer ')) return ''
  return auth.slice(7).trim()
}

function requireAdminToken(req: Request) {
  const expected = (process.env.ADMIN_PURGE_TOKEN || '').trim()
  if (!expected) return { ok: false as const, reason: 'missing_env' as const }

  const bearer = getBearer(req)
  const x = (req.headers.get('x-admin-token') || '').trim()

  if (bearer === expected || x === expected) return { ok: true as const }
  return { ok: false as const, reason: 'bad_token' as const }
}

// Helpers: parse bigint returned as string
function toInt(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export async function POST(req: Request) {
  const auth = requireAdminToken(req)
  if (!auth.ok) {
    const status = auth.reason === 'missing_env' ? 500 : 401
    return NextResponse.json(
      { error: auth.reason === 'missing_env' ? 'Missing ADMIN_PURGE_TOKEN' : 'Unauthorized' },
      { status }
    )
  }

  try {
    const url = new URL(req.url)

    // --- flags ---
    // default: solo expirados y deleted_at IS NOT NULL (más seguro)
    // si quieres "borrar todo expirado" aunque no esté soft-deleted, usa ?include_not_marked=1
    const includeNotMarked = url.searchParams.get('include_not_marked') === '1'

    // batch size
    const limit = Math.min(Math.max(toInt(url.searchParams.get('limit')), 1) || 200, 500)

    const nowIso = new Date().toISOString()

    // 1) fetch expirados
    let q = supabaseAdmin
      .from('file_links')
      .select('code,file_path,file_bytes,expires_at,deleted_at,storage_deleted')
      .lte('expires_at', nowIso)
      .order('expires_at', { ascending: true })
      .limit(limit)

    if (!includeNotMarked) {
      // modo seguro: solo los que ya fueron soft-deleted
      q = q.not('deleted_at', 'is', null)
    }

    const { data: rows, error: fetchErr } = await q
    if (fetchErr) throw new Error(fetchErr.message)

    const items = rows ?? []
    if (!items.length) {
      return NextResponse.json(
        { ok: true, found: 0, deletedFromStorage: 0, deletedRows: 0, failed: 0 },
        { status: 200 }
      )
    }

    let deletedFromStorage = 0
    let deletedRows = 0
    let failed = 0

    // 2) borrar storage (best effort)
    for (const r of items) {
      const code = String(r.code)
      const file_path = String(r.file_path || '')
      if (!file_path) {
        failed += 1
        continue
      }

      // si ya estaba marcado como storage_deleted, nos saltamos borrar en storage
      const alreadyStorageDeleted = Boolean(r.storage_deleted)

      if (!alreadyStorageDeleted) {
        const { error: delErr } = await supabaseAdmin.storage.from('uploads').remove([file_path])

        // remove() devuelve error si no existe, permisos, etc.
        // Aun si no existe, nos sirve marcar storage_deleted=true para avanzar.
        if (!delErr) deletedFromStorage += 1

        // marcamos como "intentado / ya no está" si:
        // - no hubo error
        // - o el error sugiere que el objeto no existe (lo tratamos como ok)
        const treatAsGone =
          !delErr ||
          (typeof delErr.message === 'string' &&
            (delErr.message.toLowerCase().includes('not found') ||
              delErr.message.toLowerCase().includes('does not exist') ||
              delErr.message.toLowerCase().includes('404')))

        if (treatAsGone) {
          const { error: markErr } = await supabaseAdmin
            .from('file_links')
            .update({ storage_deleted: true })
            .eq('code', code)

          if (markErr) {
            failed += 1
            continue
          }
        } else {
          failed += 1
          continue
        }
      }

      // 3) hard delete row (solo si storage_deleted=true)
      const { error: delRowErr } = await supabaseAdmin
        .from('file_links')
        .delete()
        .eq('code', code)
        .eq('storage_deleted', true)

      if (delRowErr) {
        failed += 1
        continue
      }
      deletedRows += 1
    }

    return NextResponse.json(
      {
        ok: true,
        found: items.length,
        deletedFromStorage,
        deletedRows,
        failed,
        mode: includeNotMarked ? 'expired_any' : 'expired_soft_deleted_only',
        limit,
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}