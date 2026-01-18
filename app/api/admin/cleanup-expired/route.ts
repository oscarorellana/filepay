import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ------------------------- auth helpers ------------------------- */

function getBearer(req: Request) {
  const auth = (req.headers.get('authorization') || '').trim()
  if (!auth.toLowerCase().startsWith('bearer ')) return ''
  return auth.slice(7).trim()
}

function getTokenFromQuery(req: Request) {
  const url = new URL(req.url)
  return (url.searchParams.get('token') || '').trim()
}

function base64urlEncode(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return b
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

function requireAdmin(req: Request) {
  const expected = (process.env.ADMIN_PURGE_TOKEN || '').trim()

  // token puede venir por bearer / header / query
  const bearer = getBearer(req)
  const x = (req.headers.get('x-admin-token') || '').trim()
  const qtoken = getTokenFromQuery(req)
  const token = bearer || x || qtoken

  // 1) ADMIN_PURGE_TOKEN
  if (expected && token === expected) return { ok: true as const, via: 'purge_token' as const }

  // 2) signed action token (del email)
  const v = token ? verifyActionToken(token) : { ok: false as const, reason: 'missing' as const }
  if (v.ok) return { ok: true as const, via: 'action_token' as const }

  // si no hay nada configurado
  const secret = (process.env.ADMIN_ACTION_SECRET || '').trim()
  if (!expected && !secret) return { ok: false as const, reason: 'missing_env' as const }

  return { ok: false as const, reason: 'bad_token' as const }
}

/* ------------------------- query helpers ------------------------- */

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

function includeNotMarked(req: Request) {
  const url = new URL(req.url)
  return url.searchParams.get('include_not_marked') === '1'
}

function isDryRun(req: Request) {
  const url = new URL(req.url)
  return url.searchParams.get('dry_run') === '1'
}

function wantsHtml(req: Request) {
  const accept = (req.headers.get('accept') || '').toLowerCase()
  return accept.includes('text/html')
}

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

/* ------------------------- handler ------------------------- */

export async function POST(req: Request) {
  const auth = requireAdmin(req)
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
    const includeAllExpired = includeNotMarked(req)
    const dryRun = isDryRun(req)
    const nowIso = new Date().toISOString()

    // 1) fetch expirados (según modo)
    let q: any = supabaseAdmin
      .from('file_links')
      .select('code,file_path,file_bytes,expires_at,deleted_at,storage_deleted')
      .lte('expires_at', nowIso)
      .order('expires_at', { ascending: true })
      .limit(limit)

    if (!includeAllExpired) {
      // modo seguro: solo soft-deleted
      q = q.not('deleted_at', 'is', null)
    }

    const { data: rows, error: fetchErr } = await q
    if (fetchErr) throw new Error(fetchErr.message)

    const items = (rows ?? []) as any[]
    const found = items.length
    const totalBytesFound = items.reduce((acc, r) => acc + toInt(r.file_bytes), 0)

    // si no hay nada
    if (!found) {
      const payload = {
        ok: true,
        dryRun,
        via: auth.via,
        found: 0,
        totalBytesFound: 0,
        totalBytesFoundHuman: bytesToHuman(0),
        softDeleted: 0,
        deletedFromStorage: 0,
        deletedRows: 0,
        failed: 0,
        mode: includeAllExpired ? 'expired_any' : 'expired_soft_deleted_only',
        limit,
      }

      if (wantsHtml(req)) {
        const url = new URL('/admin/cleanup-expired/done', req.url)
        Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, String(v)))
        return NextResponse.redirect(url, 303)
      }

      return NextResponse.json(payload, { status: 200 })
    }

    // DRY RUN: no borra
    if (dryRun) {
      const payload = {
        ok: true,
        dryRun: true,
        via: auth.via,
        found,
        totalBytesFound,
        totalBytesFoundHuman: bytesToHuman(totalBytesFound),
        softDeleted: 0,
        deletedFromStorage: 0,
        deletedRows: 0,
        failed: 0,
        mode: includeAllExpired ? 'expired_any' : 'expired_soft_deleted_only',
        limit,
      }

      if (wantsHtml(req)) {
        const url = new URL('/admin/cleanup-expired/done', req.url)
        Object.entries(payload).forEach(([k, v]) => url.searchParams.set(k, String(v)))
        return NextResponse.redirect(url, 303)
      }

      return NextResponse.json(payload, { status: 200 })
    }

    // REAL RUN
    let softDeleted = 0
    let deletedFromStorage = 0
    let deletedRows = 0
    let failed = 0
    const failures: Array<{ code: string; file_path: string; error: string }> = []

    // 2) si include_not_marked=1: soft delete primero
    if (includeAllExpired) {
      const codes = items.map((r) => String(r.code || '')).filter(Boolean)
      if (codes.length) {
        const { data: updated, error: updErr } = await supabaseAdmin
          .from('file_links')
          .update({ deleted_at: nowIso, deleted_reason: 'expired_cleanup' })
          .in('code', codes)
          .is('deleted_at', null)
          .select('code')

        if (updErr) {
          failures.push({ code: '(batch)', file_path: '(n/a)', error: updErr.message })
        } else {
          softDeleted = (updated ?? []).length
        }
      }
    }

    // 3) storage remove + mark storage_deleted + hard delete row
    for (const r of items) {
      const code = String(r.code || '')
      const file_path = typeof r.file_path === 'string' ? r.file_path : ''

      if (!code || !file_path) {
        failed += 1
        failures.push({
          code: code || '(missing)',
          file_path: file_path || '(missing)',
          error: 'missing code/file_path',
        })
        continue
      }

      const alreadyStorageDeleted = Boolean(r.storage_deleted)

      if (!alreadyStorageDeleted) {
        const { error: delErr } = await supabaseAdmin.storage.from('uploads').remove([file_path])

        if (!delErr) deletedFromStorage += 1

        const msg = (delErr?.message || '').toLowerCase()
        const treatAsGone =
          !delErr || msg.includes('not found') || msg.includes('does not exist') || msg.includes('404')

        if (!treatAsGone) {
          failed += 1
          failures.push({ code, file_path, error: delErr?.message || 'storage remove failed' })
          continue
        }

        const { error: markErr } = await supabaseAdmin
          .from('file_links')
          .update({ storage_deleted: true })
          .eq('code', code)

        if (markErr) {
          failed += 1
          failures.push({ code, file_path, error: `mark storage_deleted failed: ${markErr.message}` })
          continue
        }
      }

      const { error: delRowErr } = await supabaseAdmin
        .from('file_links')
        .delete()
        .eq('code', code)
        .eq('storage_deleted', true)

      if (delRowErr) {
        failed += 1
        failures.push({ code, file_path, error: `db delete failed: ${delRowErr.message}` })
        continue
      }

      deletedRows += 1
    }

    const payload = {
      ok: true,
      dryRun: false,
      via: auth.via,
      found,
      totalBytesFound,
      totalBytesFoundHuman: bytesToHuman(totalBytesFound),
      softDeleted,
      deletedFromStorage,
      deletedRows,
      failed,
      failures: failures.slice(0, 20),
      mode: includeAllExpired ? 'expired_any' : 'expired_soft_deleted_only',
      limit,
    }

    if (wantsHtml(req)) {
      const url = new URL('/admin/cleanup-expired/done', req.url)
      url.searchParams.set('via', payload.via)
      url.searchParams.set('mode', payload.mode)
      url.searchParams.set('dryRun', '0')
      url.searchParams.set('found', String(payload.found))
      url.searchParams.set('totalBytesFoundHuman', payload.totalBytesFoundHuman)
      url.searchParams.set('softDeleted', String(payload.softDeleted))
      url.searchParams.set('deletedFromStorage', String(payload.deletedFromStorage))
      url.searchParams.set('deletedRows', String(payload.deletedRows))
      url.searchParams.set('failed', String(payload.failed))
      return NextResponse.redirect(url, 303)
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

// preview in browser
export async function GET(req: Request) {
  return POST(req)
}