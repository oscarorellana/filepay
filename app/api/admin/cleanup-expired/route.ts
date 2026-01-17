import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs' // 👈 importante: asegura env vars en runtime Node

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

export async function POST(req: Request) {
  const auth = requireAdminToken(req)

  if (!auth.ok) {
    // 👇 CLAVE: ya no es todo 401
    const status = auth.reason === 'missing_env' ? 500 : 401
    return NextResponse.json(
      { error: auth.reason === 'missing_env' ? 'Missing ADMIN_PURGE_TOKEN' : 'Unauthorized' },
      { status }
    )
  }

  // --- tu lógica real de cleanup aquí ---
  // Ejemplo mínimo de respuesta para probar auth primero:
  return NextResponse.json({ ok: true }, { status: 200 })
}