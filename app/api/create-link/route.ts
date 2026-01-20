import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CreateLinkBody = {
  file_path?: unknown
  days?: unknown
  file_bytes?: unknown
  created_by_user_id?: unknown

  accepted?: unknown
  tos_version?: unknown
  privacy_version?: unknown
}

function makeCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

// bigint suele venir string desde Supabase, pero aquí sólo parseamos input
function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.floor(v)
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return null
}

function getClientIp(req: Request) {
  // Vercel / proxies
  const xff = req.headers.get('x-forwarded-for') || ''
  const ip = xff.split(',')[0]?.trim()
  return ip || req.headers.get('x-real-ip') || ''
}

function getUserAgent(req: Request) {
  return (req.headers.get('user-agent') || '').slice(0, 300)
}

function getExt(filePath: string) {
  const s = filePath.toLowerCase()
  const i = s.lastIndexOf('.')
  return i >= 0 ? s.slice(i + 1) : ''
}

// Reglas simples (opción 1 “rápida”)
function flagRules(filePath: string, fileBytes: number | null) {
  const ext = getExt(filePath)

  const blockedExt = new Set([
    'exe','dll','msi','bat','cmd','ps1','vbs','js','jar','scr','com','apk','dmg','pkg'
  ])

  if (blockedExt.has(ext)) {
    return { flagged: true, reason: `blocked_extension:${ext}` }
  }

  // tamaño (ajusta a tu gusto)
  const MAX_BYTES = 200 * 1024 * 1024 // 200MB
  if (typeof fileBytes === 'number' && fileBytes > MAX_BYTES) {
    return { flagged: true, reason: `too_large:${fileBytes}` }
  }

  return { flagged: false, reason: '' }
}

async function audit(event: {
  event_type: string
  code?: string
  file_path?: string
  file_bytes?: number | null
  user_id?: string | null
  ip?: string
  user_agent?: string
  meta?: Record<string, any>
}) {
  await supabaseAdmin.from('audit_events').insert({
    event_type: event.event_type,
    code: event.code ?? null,
    file_path: event.file_path ?? null,
    file_bytes: event.file_bytes ?? null,
    user_id: event.user_id ?? null,
    ip: event.ip ?? null,
    user_agent: event.user_agent ?? null,
    meta: event.meta ?? {},
  })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as CreateLinkBody

    const ip = getClientIp(req)
    const userAgent = getUserAgent(req)

    const file_path = typeof body.file_path === 'string' ? body.file_path.trim() : ''
    if (!file_path) return NextResponse.json({ error: 'Missing file_path' }, { status: 400 })

    const daysNum = toInt(body.days) ?? 14
    const safeDays = [1, 3, 7, 14, 30].includes(daysNum) ? daysNum : 14

    const file_bytes = toInt(body.file_bytes) // null si no viene
    const created_by_user_id =
      typeof body.created_by_user_id === 'string' && body.created_by_user_id.trim()
        ? body.created_by_user_id.trim()
        : null

    // ✅ aceptación obligatoria (si quieres hacerlo obligatorio)
    const accepted = body.accepted === true
    if (!accepted) {
      await audit({
        event_type: 'link_create_denied_not_accepted',
        file_path,
        file_bytes,
        user_id: created_by_user_id,
        ip,
        user_agent: userAgent,
      })
      return NextResponse.json({ error: 'Must accept Terms and Privacy Policy' }, { status: 400 })
    }

    const tos_version = typeof body.tos_version === 'string' ? body.tos_version.trim() : null
    const privacy_version = typeof body.privacy_version === 'string' ? body.privacy_version.trim() : null

    const expires_at = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000).toISOString()

    // flags
    const rule = flagRules(file_path, file_bytes)

    // code único
    let code = makeCode(8)
    for (let i = 0; i < 10; i++) {
      const { data } = await supabaseAdmin.from('file_links').select('code').eq('code', code).maybeSingle()
      if (!data) break
      code = makeCode(8)
    }

    const nowIso = new Date().toISOString()

    const insertPayload: Record<string, unknown> = {
      code,
      file_path,
      paid: false,
      expires_at,
      file_bytes,

      accepted_at: nowIso,
      accepted_ip: ip || null,
      accepted_user_agent: userAgent || null,
      tos_version,
      privacy_version,

      flagged: rule.flagged,
      flag_reason: rule.flagged ? rule.reason : null,
      flagged_at: rule.flagged ? nowIso : null,
    }

    if (created_by_user_id) insertPayload.created_by_user_id = created_by_user_id

    const { error: insErr } = await supabaseAdmin.from('file_links').insert(insertPayload)
    if (insErr) {
      await audit({
        event_type: 'link_create_failed',
        file_path,
        file_bytes,
        user_id: created_by_user_id,
        ip,
        user_agent: userAgent,
        meta: { error: insErr.message },
      })
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    await audit({
      event_type: rule.flagged ? 'link_created_flagged' : 'link_created',
      code,
      file_path,
      file_bytes,
      user_id: created_by_user_id,
      ip,
      user_agent: userAgent,
      meta: { days: safeDays, flagged: rule.flagged, reason: rule.reason },
    })

    // si está flagged, tú decides: ¿bloquear o solo advertir?
    // opción “segura”: impedir que creen links para extensiones bloqueadas.
    if (rule.flagged && rule.reason.startsWith('blocked_extension')) {
      return NextResponse.json(
        { error: 'This file type is not allowed.' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { code, expires_at, days: safeDays, file_bytes, flagged: rule.flagged, flag_reason: rule.reason },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}