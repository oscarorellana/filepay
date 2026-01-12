import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : null

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRes, error: userErr } =
    await supabaseAdmin.auth.getUser(token)

  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('file_links')
    .select(`
      id,
      code,
      file_path,
      created_at,
      paid,
      paid_at,
      expires_at,
      days
    `)
    .eq('created_by_user_id', userRes.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ links: data })
}