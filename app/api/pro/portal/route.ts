import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL ?? '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url) throw new Error('Missing SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

function getOrigin(req: Request) {
  const env = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (env) return env.replace(/\/+$/, '')
  const hdr = (req.headers.get('origin') ?? '').trim()
  if (hdr) return hdr.replace(/\/+$/, '')
  return 'http://localhost:3000'
}

function isStripeNoSuchCustomer(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const msg = 'message' in err ? String((err as { message?: unknown }).message ?? '') : ''
  const code = 'code' in err ? String((err as { code?: unknown }).code ?? '') : ''
  return code === 'resource_missing' || msg.toLowerCase().includes('no such customer')
}

type SubRow = {
  plan: string | null
  status: string | null
  stripe_customer_id: string | null
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const stripe = getStripe()

    // 1) Auth token
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    // 2) Get user from token
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = userRes.user
    const userId = user.id
    const email = (user.email ?? '').trim()

    // 3) Load subscription row
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('plan,status,stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 })
    }

    const sub = (subRow ?? null) as SubRow | null
    const isPro = sub?.plan === 'pro' && sub?.status === 'active'

    // ✅ Si NO es pro, no abras portal: manda a “Upgrade”
    if (!isPro) {
      return NextResponse.json(
        { error: 'Not Pro. Upgrade required.' },
        { status: 403 }
      )
    }

    // 4) Ensure we have a valid Stripe customer
    let customerId = (sub?.stripe_customer_id ?? '').trim()

    async function createAndPersistCustomer() {
      // create customer in Stripe
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { user_id: userId },
      })

      // persist to DB
      const { error: upErr } = await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: customer.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

      if (upErr) throw new Error(upErr.message)
      return customer.id
    }

    if (!customerId) {
      customerId = await createAndPersistCustomer()
    } else {
      // Verify customer exists (handles stale cus_ ids)
      try {
        await stripe.customers.retrieve(customerId)
      } catch (err: unknown) {
        if (isStripeNoSuchCustomer(err)) {
          customerId = await createAndPersistCustomer()
        } else {
          throw err
        }
      }
    }

    // 5) Create billing portal session
    const origin = getOrigin(req)
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