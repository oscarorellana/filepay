import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin'

function makeCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // evita 0/O/1/I
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const file_path = body?.file_path as string | undefined
    const daysRaw = body?.days

    // 👇 NUEVO: tamaño del archivo (bytes)
    const file_bytes =
      typeof body?.file_bytes === 'number' && body.file_bytes > 0
        ? body.file_bytes
        : null

    // opcional (si lo mandas desde el frontend)
    const created_by_user_id = (body?.created_by_user_id as string | undefined) ?? null

    if (!file_path || typeof file_path !== 'string') {
      return NextResponse.json({ error: 'Missing file_path' }, { status: 400 })
    }

    // days seguro
    const daysNum = Number(daysRaw ?? 14)
    const safeDays = [1, 3, 7, 14, 30].includes(daysNum) ? daysNum : 14

    const expires_at = new Date(
      Date.now() + safeDays * 24 * 60 * 60 * 1000
    ).toISOString()

    // Generar code único (hasta 10 intentos)
    let code = makeCode(8)
    for (let i = 0; i < 10; i++) {
      const { data } = await supabaseAdmin
        .from('file_links')
        .select('code')
        .eq('code', code)
        .maybeSingle()

      if (!data) break
      code = makeCode(8)
    }

    // Payload SOLO con columnas existentes
    const insertPayload: Record<string, unknown> = {
      code,
      file_path,
      paid: false,
      expires_at,
      file_bytes, // ✅ NUEVO
    }

    if (created_by_user_id) {
      insertPayload.created_by_user_id = created_by_user_id
    }

    const { error: insErr } = await supabaseAdmin
      .from('file_links')
      .insert(insertPayload)

    if (insErr) {
      console.error('create-link insert error:', insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        code,
        expires_at,
        days: safeDays,
        file_bytes,
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    console.error('create-link error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}