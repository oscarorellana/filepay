// app/api/admin/cleanup-expired/route.ts
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * ========= AUTH =========
 * - ADMIN_PURGE_TOKEN: para curl/manual
 * - ADMIN_ACTION_SECRET: para tokens firmados enviados por email
 *
 * Acepta token desde:
 * - Authorization: Bearer <token>
 * - x-admin-token: <token>
 * - ?token=<token>
 * - Body form: token=<token> (para <form method="POST">)
 */

function getBearer(req: Request) {
  const auth = (req.headers.get('authorization') || '').trim()
  if (!auth.toLowerCase().startsWith('bearer ')) return ''
  return auth.slice(7).trim()
}

function getQueryToken(req: Request) {
  const url = new URL(req.url)
  return (url.searchParams.get('token') || '').trim()
}

async function getBodyToken(req: Request): Promise<string> {
  const ct = (req.headers.get('content-type') || '').toLowerCase()

  // Form POST: application/x-www-form-urlencoded o multipart
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    try {
      const fd = await req.formData()
      const t = fd.get('token')
      return typeof t === 'string' ? t.trim() : ''
    } catch {
      return ''
    }
  }

  // JSON POST (si algún día lo usas)
  if (ct.includes('application/json')) {
    try {
      const body = (await req.json().catch(() => ({}))) as any
      return typeof body?.token === 'string' ? body.token.trim() : ''
    } catch {
      return ''
    }
  }

  return ''
}

function base64urlEncode(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64urlDecodeToString(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const withPad = padded + '='.repeat(padLen)
  return Buffer.from(withPad, 'base64').toString('utf8')
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

type ActionPayload = {
  action: 'purge_expired'
  exp: number // unix seconds
  nonce: string
}

function verifyActionToken(token: string) {
  const secret = (process.env.ADMIN_ACTION_SECRET || '').trim()
  if (!secret) return { ok: false as const, reason: 'missing_secret' as const }

  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false as const, reason: 'bad_format' as const }

  const [payloadB64, sigB64] = parts

  const mac = crypto.createHmac('sha256', secret).update(payloadB64).digest()
  const expectedSigB64 = base64urlEncode(mac)

  if (!safeEqual(sigB64, expectedSigB64)) {
    return { ok: false as const, reason: 'bad_sig' as const }
  }

  let payload: ActionPayload
  try {
    payload = JSON.parse(base64urlDecodeToString(payloadB64)) as ActionPayload
  } catch {
    return { ok: false as const, reason: 'bad_json' as const }
  }

  if (!payload || payload.action !== 'purge_expired') {
    return { ok: false as const, reason: 'bad_action' as const }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (!payload.exp || payload.exp <= nowSec) {
    return { ok: false as const, reason: 'expired' as const }
  }

  if (!payload.nonce || typeof payload.nonce !== 'string') {
    return { ok: false as const, reason: 'no_nonce' as const }
  }

  return { ok: true as const }
}

async function requireAdmin(req: Request) {
  const expected = (process.env.ADMIN_PURGE_TOKEN || '').trim()

  const bearer = getBearer(req)
  const headerX = (req.headers.get('x-admin-token') || '').trim()
  const query = getQueryToken(req)
  const body = await getBodyToken(req)

  const token = bearer || headerX || query || body

  // 1) ADMIN_PURGE_TOKEN (curl/manual)
  if (expected && token === expected) return { ok: true as const, via: 'purge_token' as const }

  // 2) Action token firmado (link del correo)
  if (token) {
    const v = verifyActionToken(token)
    if (v.ok) return { ok: true as const, via: 'action_token' as const }
  }

  // Si no hay ninguna auth configurada, explícalo
  if (!expected && !(process.env.ADMIN_ACTION_SECRET || '').trim()) {
    return { ok: false as const, reason: 'missing_env' as const }
  }

  return { ok: false as const, reason: 'bad_token' as const }
}

/**
 * ========= PARAMS =========
 * limit (1..500) default 200
 * dryRun=1 para simular
 * include_not_marked=1 para incluir expirados aunque deleted_at sea NULL
 */
function toInt(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.floor(v) : 0
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function parseLimit(req: Request) {
  const url = new URL(req.url)
  const raw = url.searchParams.get('limit')
  const n = toInt(raw)
  const def = 200
  const val = n > 0 ? n : def
  return Math.min(Math.max(val, 1), 500)
}

function parseDryRun(req: Request) {
  const url = new URL(req.url)
  return url.searchParams.get('dryRun') === '1' || url.searchParams.get('dry_run') === '1'
}

function parseIncludeNotMarked(req: Request) {
  const url = new URL(req.url)
  // por default: SÍ incluir no marcados (esto hace que el botón del correo funcione siempre)
  // si quieres modo ultra-seguro: pasa include_not_marked=0
  const p = url.searchParams.get('include_not_marked')
  if (p === null || p === '') return true
  return p === '1'
}

/**
 * ========= CORE =========
 * - Si expirado y deleted_at es NULL => soft delete (deleted_at, deleted_reason)
 * - Storage remove
 * - Verifica que no exista en storage.objects
 * - Marca storage_deleted=true
 * - Hard delete row (solo si storage_deleted=true)
 */
function bytesToHuman(n: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) {
    const status = auth.reason === 'missing_env' ? 500 : 401
    return NextResponse.json(
      {
        error:
          auth.reason === 'missing_env'
            ? 'Missing ADMIN_PURGE_TOKEN and ADMIN_ACTION_SECRET'
            : 'Unauthorized',
      },
      { status }
    )
  }

  try {
    const limit = parseLimit(req)
    const dryRun = parseDryRun(req)
    const includeNotMarked = parseIncludeNotMarked(req)
    const nowIso = new Date().toISOString()

    // 1) fetch expirados
    let q: any = supabaseAdmin
      .from('file_links')
      .select('code,file_path,file_bytes,expires_at,deleted_at,storage_deleted')
      .lte('expires_at', nowIso)
      .order('expires_at', { ascending: true })
      .limit(limit)

    // modo seguro opcional: solo los ya marcados
    if (!includeNotMarked) {
      q = q.not('deleted_at', 'is', null)
    }

    const { data: rows, error: fetchErr } = await q
    if (fetchErr) throw new Error(fetchErr.message)

    const items = (rows ?? []) as any[]
    if (!items.length) {
      return NextResponse.json(
        {
          ok: true,
          dryRun,
          via: auth.via,
          found: 0,
          totalBytesFound: 0,
          softDeleted: 0,
          deletedFromStorage: 0,
          deletedRows: 0,
          failed: 0,
          mode: includeNotMarked ? 'expired_any' : 'expired_soft_deleted_only',
          limit,
        },
        { status: 200 }
      )
    }

    let softDeleted = 0
    let deletedFromStorage = 0
    let deletedRows = 0
    let failed = 0

    const totalBytesFound = items.reduce((acc, r) => acc + toInt(r.file_bytes), 0)

    for (const r of items) {
      const code = String(r.code || '').trim()
      const file_path = typeof r.file_path === 'string' ? r.file_path.trim() : ''
      const alreadyStorageDeleted = Boolean(r.storage_deleted)
      const hasSoft = Boolean(r.deleted_at)

      if (!code || !file_path) {
        failed += 1
        continue
      }

      // A) Soft delete si no está marcado
      if (!hasSoft) {
        if (!dryRun) {
          const { error: softErr } = await supabaseAdmin
            .from('file_links')
            .update({
              deleted_at: nowIso,
              deleted_reason: 'expired_cleanup',
            })
            .eq('code', code)
            .is('deleted_at', null)

          if (softErr) {
            failed += 1
            continue
          }
        }
        softDeleted += 1
      }

      // B) Storage delete (best effort) + verificación real
      if (!alreadyStorageDeleted) {
        if (!dryRun) {
          const { error: delErr } = await supabaseAdmin.storage.from('uploads').remove([file_path])

          if (delErr) {
            failed += 1
            continue
          }

          // Verifica de verdad contra storage.objects
          const { data: stillThere, error: checkErr } = await supabaseAdmin
            .from('storage.objects')
            .select('id')
            .eq('bucket_id', 'uploads')
            .eq('name', file_path)
            .maybeSingle()

          if (checkErr) {
            failed += 1
            continue
          }

          if (stillThere) {
            // NO se borró realmente
            failed += 1
            continue
          }

          // Marca storage_deleted=true
          const { error: markErr } = await supabaseAdmin
            .from('file_links')
            .update({ storage_deleted: true })
            .eq('code', code)

          if (markErr) {
            failed += 1
            continue
          }
        }

        // en dryRun lo contamos como "se intentaría"
        deletedFromStorage += 1
      }

      // C) Hard delete row (solo si storage_deleted=true)
      if (!dryRun) {
        const { error: delRowErr } = await supabaseAdmin
          .from('file_links')
          .delete()
          .eq('code', code)
          .eq('storage_deleted', true)

        if (delRowErr) {
          failed += 1
          continue
        }
      }

      deletedRows += 1
    }

    return NextResponse.json(
      {
        ok: true,
        dryRun,
        via: auth.via,
        found: items.length,
        totalBytesFound,
        totalBytesFoundHuman: bytesToHuman(totalBytesFound),
        softDeleted,
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

// Opcional: para probar en browser
export async function GET(req: Request) {
  return POST(req)
}