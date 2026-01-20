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

/** ===== Limits / Policy ===== */
const MAX_BYTES = 2 * 1024 * 1024 * 1024 // 2GB

// Block high-risk / executable formats (+ ISO por ahora)
const BLOCKED_EXT = new Set([
  'exe',
  'dll',
  'msi',
  'bat',
  'cmd',
  'ps1',
  'vbs',
  'js',
  'jar',
  'lnk',
  'scr',
  'com',
  'apk',
  'dmg',
  'pkg',
  'sh',
  'iso',
])

function extFromPath(p: string): string {
  const clean = p.split('?')[0].split('#')[0]
  const last = clean.split('/').pop() || ''
  const dot = last.lastIndexOf('.')
  if (dot === -1) return ''
  return last.slice(dot + 1).toLowerCase()
}

function makeCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // avoid 0/O/1/I
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

// input parsing (safe for <= 2GB)
function toPositiveInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.floor(v)
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return null
}

function getClientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for') || ''
  const ip = xff.split(',')[0]?.trim()
  return ip || req.headers.get('x-real-ip') || ''
}

function getUserAgent(req: Request) {
  return (req.headers.get('user-agent') || '').slice(0, 300)
}

/**
 * Optional: “flag” rules (does NOT block, only marks)
 * - You can expand later (virus scan, content hashing, etc.)
 */
function flagRules(filePath: string, fileBytes: number | null) {
  const ext = extFromPath(filePath)

  // Example: flag very large videos even if allowed (but still under MAX_BYTES)
  const SOFT_FLAG_BYTES = 800 * 1024 * 1024 // 800MB
  if (typeof fileBytes === 'number' && fileBytes > SOFT_FLAG_BYTES) {
    return { flagged: true, reason: `large_file:${fileBytes}` }
  }

  // Example: flag unknown extension (optional)
  if (!ext) {
    return { flagged: true, reason: 'missing_extension' }
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
  // If audit table doesn’t exist, this would throw.
  // If you want it “non-blocking”, wrap the insert in try/catch.
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
    if (!file_path) {
      return NextResponse.json({ error: 'Missing file_path' }, { status: 400 })
    }

    // ✅ parse file_bytes BEFORE using it
    const file_bytes = toPositiveInt(body.file_bytes) // null if missing/invalid

    // ✅ hard block by extension
    const ext = extFromPath(file_path)
    if (ext && BLOCKED_EXT.has(ext)) {
      await audit({
        event_type: 'link_create_denied_blocked_ext',
        file_path,
        file_bytes,
        user_id: typeof body.created_by_user_id === 'string' ? body.created_by_user_id.trim() : null,
        ip,
        user_agent: userAgent,
        meta: { ext },
      })
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    // ✅ hard block by size
    if (file_bytes !== null && file_bytes > MAX_BYTES) {
      await audit({
        event_type: 'link_create_denied_too_large',
        file_path,
        file_bytes,
        user_id: typeof body.created_by_user_id === 'string' ? body.created_by_user_id.trim() : null,
        ip,
        user_agent: userAgent,
      })
      return NextResponse.json({ error: 'File too large (max 2 GB)' }, { status: 400 })
    }

    const daysNum = toPositiveInt(body.days) ?? 14
    const safeDays = [1, 3, 7, 14, 30].includes(daysNum) ? daysNum : 14

    const created_by_user_id =
      typeof body.created_by_user_id === 'string' && body.created_by_user_id.trim()
        ? body.created_by_user_id.trim()
        : null

    // ✅ acceptance required
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

    // optional flags (just marks, does not block)
    const rule = flagRules(file_path, file_bytes)

    // code unique (up to 10 tries)
    let code = makeCode(8)
    for (let i = 0; i < 10; i++) {
      const { data, error } = await supabaseAdmin
        .from('file_links')
        .select('code')
        .eq('code', code)
        .maybeSingle()

      if (error) {
        await audit({
          event_type: 'link_create_failed_uniqueness_check',
          file_path,
          file_bytes,
          user_id: created_by_user_id,
          ip,
          user_agent: userAgent,
          meta: { error: error.message },
        })
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

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

      // acceptance/audit fields (requires columns)
      accepted_at: nowIso,
      accepted_ip: ip || null,
      accepted_user_agent: userAgent || null,
      tos_version,
      privacy_version,

      // flags (requires columns)
      flagged: rule.flagged,
      flag_reason: rule.flagged ? rule.reason : null,
      flagged_at: rule.flagged ? nowIso : null,
    }

    if (created_by_user_id) insertPayload.created_by_user_id = created_by_user_id

    const { error: insErr } = await supabaseAdmin.from('file_links').insert(insertPayload)
    if (insErr) {
      await audit({
        event_type: 'link_create_failed_insert',
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

    return NextResponse.json(
      {
        code,
        expires_at,
        days: safeDays,
        file_bytes,
        flagged: rule.flagged,
        flag_reason: rule.flagged ? rule.reason : null,
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}