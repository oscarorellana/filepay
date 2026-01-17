// lib/admin-action.ts
import crypto from 'crypto'

type AdminActionPayload = {
  action: 'purge_expired'
  exp: number // unix seconds
  nonce: string
}

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
function b64urlJson(obj: any) {
  return b64url(Buffer.from(JSON.stringify(obj), 'utf8'))
}
function timingSafeEq(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

export function signAdminAction(action: AdminActionPayload['action'], ttlSeconds = 1800) {
  const secret = (process.env.ADMIN_ACTION_SECRET || '').trim()
  if (!secret) throw new Error('Missing ADMIN_ACTION_SECRET')

  const payload: AdminActionPayload = {
    action,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: crypto.randomBytes(16).toString('hex'),
  }

  const body = b64urlJson(payload)
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest())
  return `${body}.${sig}`
}

export function verifyAdminActionToken(token: string): AdminActionPayload | null {
  const secret = (process.env.ADMIN_ACTION_SECRET || '').trim()
  if (!secret) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts

  const expected = b64url(crypto.createHmac('sha256', secret).update(body).digest())
  if (!timingSafeEq(sig, expected)) return null

  let payload: AdminActionPayload
  try {
    payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  } catch {
    return null
  }

  if (!payload?.exp || typeof payload.exp !== 'number') return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  if (payload.action !== 'purge_expired') return null

  return payload
}