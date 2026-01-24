import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const url = (process.env.SUPABASE_URL ?? '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // 1) Ver la URL (sin exponer la key)
  // 2) Ver si existe la columna paid_session_id con una query segura
  const { data, error } = await supabase
    .from('file_links')
    .select('code, paid_session_id')
    .limit(1)

  return NextResponse.json({
    ok: !error,
    supabase_url: url,
    sample: data?.[0] ?? null,
    error: error?.message ?? null,
  })
}