// app/api/admin/purge-expired/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminActionToken } from '@/lib/admin-action'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const token = String(form.get('token') || '')
    const payload = verifyAdminActionToken(token)
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 1) Trae expirados (ajusta el limit si quieres)
    const nowIso = new Date().toISOString()
    const { data: rows, error } = await supabaseAdmin
      .from('file_links')
      .select('code,file_path,expires_at,deleted_at,storage_deleted')
      .lte('expires_at', nowIso)
      .is('deleted_at', null)
      .limit(1000)

    if (error) throw new Error(error.message)

    const expired = rows ?? []
    let deletedStorage = 0
    let softDeleted = 0
    let hardDeleted = 0

    for (const r of expired) {
      // soft delete
      const { error: markErr } = await supabaseAdmin
        .from('file_links')
        .update({ deleted_at: nowIso, deleted_reason: 'manual_purge' })
        .eq('code', r.code)
        .is('deleted_at', null)

      if (!markErr) softDeleted++

      // storage delete (best effort)
      if (r.file_path && !r.storage_deleted) {
        const { error: delErr } = await supabaseAdmin.storage.from('uploads').remove([r.file_path])
        if (!delErr) {
          deletedStorage++
          await supabaseAdmin.from('file_links').update({ storage_deleted: true }).eq('code', r.code)
        }
      }

      // ✅ PERMANENTE en DB (opcional):
      // Si de verdad quieres borrar la fila de DB, descomenta esto:
      /*
      const { error: hardErr } = await supabaseAdmin
        .from('file_links')
        .delete()
        .eq('code', r.code)

      if (!hardErr) hardDeleted++
      */
    }

    // Redirige a una pantalla simple con resultados
    return NextResponse.redirect(
      new URL(`/admin/cleanup-expired/done?soft=${softDeleted}&storage=${deletedStorage}&hard=${hardDeleted}`, req.url),
      { status: 303 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}