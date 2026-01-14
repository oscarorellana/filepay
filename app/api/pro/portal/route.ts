import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

function getOrigin(req: Request) {
  const env = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (env) return env.replace(/\/+$/, '')
  const hdr = (req.headers.get('origin') ?? '').trim()
  if (hdr) return hdr.replace(/\/+$/, '')
  return 'http://localhost:3000'
}

function isNoSuchCustomer(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const msg = 'message' in err ? String((err as { message?: unknown }).message ?? '') : ''
  const code = 'code' in err ? String((err as { code?: unknown }).code ?? '') : ''
  return code === 'resource_missing' || msg.toLowerCase().includes('no such customer')
}

async function ensureCustomer({
  stripe,
  userId,
  email,
}: {
  stripe: Stripe
  userId: string
  email: string | null
}) {
  // read current
  const { data: row, error } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  let customerId = (row?.stripe_customer_id ?? '').trim()

  const createAndPersist = async () => {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { user_id: userId },
    })

    const { error: upErr } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        { user_id: userId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (upErr) throw new Error(upErr.message)
    return customer.id
  }

  if (!customerId) {
    customerId = await createAndPersist()
  } else {
    try {
      await stripe.customers.retrieve(customerId)
    } catch (e) {
      if (isNoSuchCustomer(e)) {
        customerId = await createAndPersist()
      } else {
        throw e
      }
    }
  }

  return customerId
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const stripe = getStripe()
    const origin = getOrigin(req)

    const customerId = await ensureCustomer({
      stripe,
      userId: userRes.user.id,
      email: userRes.user.email ?? null,
    })

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
      configuration: process.env.STRIPE_BILLING_PORTAL_CONFIG_ID || undefined,
    })

    return NextResponse.json({ url: portal.url }, { status: 200 })
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? 'Server error')
        : 'Server error'
    console.error('pro/portal error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}