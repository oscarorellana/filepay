import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin'

type CreateLinkBody = {
  file_path?: unknown
  days?: unknown
  file_bytes?: unknown
  created_by_user_id?: unknown
}

function makeCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function parsePositiveInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.floor(v)
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as CreateLinkBody

    const file_path = typeof body.file_path === 'string' ? body.file_path.trim() : ''
    if (!file_path) {
      return NextResponse.json({ error: 'Missing file_path' }, { status: 400 })
    }

    const daysNum = parsePositiveInt(body.days) ?? 14
    const safeDays = [1, 3, 7, 14, 30].includes(daysNum) ? daysNum : 14

    // ✅ bytes (BIGINT en DB)
    const file_bytes = parsePositiveInt(body.file_bytes)

    const created_by_user_id =
      typeof body.created_by_user_id === 'string' && body.created_by_user_id.trim()
        ? body.created_by_user_id.trim()
        : null

    const expires_at = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString()

    // code único
    let code = makeCode(8)
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabaseAdmin
        .from('file_links')
        .select('code')
        .eq('code', code)
        .maybeSingle()

      if (error) {
        console.error('create-link uniqueness check error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (!data) break
      code = makeCode(8)
    }

    // ✅ payload
    const insertPayload: Record<string, unknown> = {
      code,
      file_path,
      paid: false,
      expires_at,
    }

    // ✅ solo setear si viene válido
    if (file_bytes != null) insertPayload.file_bytes = file_bytes
    if (created_by_user_id) insertPayload.created_by_user_id = created_by_user_id

    const { error: insErr } = await supabaseAdmin.from('file_links').insert(insertPayload)

    if (insErr) {
      console.error('create-link insert error:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ code, expires_at, days: safeDays, file_bytes }, { status: 200 })
  } catch (err: unknown) {
    console.error('create-link error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}