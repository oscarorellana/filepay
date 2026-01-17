import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function requireSecret(req: Request) {
  const got =
    (req.headers.get('x-cron-secret') || req.headers.get('authorization') || '').trim()

  const expected = (process.env.CRON_SECRET || '').trim()
  if (!expected) return false

  // soporta:
  // - x-cron-secret: <secret>
  // - Authorization: Bearer <secret>
  if (got.toLowerCase().startsWith('bearer ')) {
    return got.slice(7).trim() === expected
  }
  return got === expected
}

function toInt(v: any): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v)
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export async function POST(req: Request) {
  try {
    if (!requireSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({} as any))
    const limit = Math.min(Math.max(toInt(body?.limit) || 50, 1), 500)
    const doHardDelete = Boolean(body?.hard_delete) // por defecto false

    const nowIso = new Date().toISOString()

    // 1) busca expirados (no borrados)
    const { data: rows, error: qErr } = await supabaseAdmin
      .from('file_links')
      .select('code,file_path,expires_at,deleted_at,storage_deleted')
      .lte('expires_at', nowIso)
      .is('deleted_at', null)
      .order('expires_at', { ascending: true })
      .limit(limit)

    if (qErr) throw new Error(qErr.message)

    if (!rows?.length) {
      return NextResponse.json({ ok: true, found: 0, marked: 0, storageDeleted: 0, hardDeleted: 0 })
    }

    let marked = 0
    let storageDeleted = 0
    let hardDeleted = 0

    // 2) procesar uno por uno (simple y seguro)
    for (const r of rows) {
      const code = r.code as string
      const file_path = (r.file_path as string) || ''

      // 2a) soft delete idempotente
      const { data: m, error: mErr } = await supabaseAdmin
        .from('file_links')
        .update({ deleted_at: nowIso, deleted_reason: 'expired_cleanup' })
        .eq('code', code)
        .is('deleted_at', null)
        .select('code')
        .maybeSingle()

      if (mErr) throw new Error(mErr.message)
      if (m) marked += 1

      // 2b) borrar storage best-effort
      if (file_path) {
        const { error: delErr } = await supabaseAdmin.storage.from('uploads').remove([file_path])

        if (!delErr) {
          storageDeleted += 1
          await supabaseAdmin
            .from('file_links')
            .update({ storage_deleted: true })
            .eq('code', code)
        }
      }

      // 2c) hard delete DB (opcional) SOLO si storage_deleted=true
      if (doHardDelete) {
        const { data: check } = await supabaseAdmin
          .from('file_links')
          .select('storage_deleted')
          .eq('code', code)
          .maybeSingle()

        if (check?.storage_deleted === true) {
          const { error: hdErr } = await supabaseAdmin.from('file_links').delete().eq('code', code)
          if (!hdErr) hardDeleted += 1
        }
      }
    }

    return NextResponse.json({
      ok: true,
      found: rows.length,
      marked,
      storageDeleted,
      hardDeleted,
      limit,
      hard_delete: doHardDelete,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}