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

    const priceId = (process.env.STRIPE_PRO_PRICE_ID ?? '').trim()
    if (!priceId) {
      return NextResponse.json({ error: 'Missing STRIPE_PRO_PRICE_ID' }, { status: 500 })
    }

    // 1) Auth
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    // 2) User
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = userRes.user
    const userId = user.id
    const email = (user.email ?? '').trim()

    // 3) Read subscription row (maybe has stale customer)
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('plan,status,stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })

    const sub = (subRow ?? null) as SubRow | null
    const isAlreadyPro = sub?.plan === 'pro' && sub?.status === 'active'
    if (isAlreadyPro) {
      // Already pro => send them to billing
      return NextResponse.json({ url: `${getOrigin(req)}/billing` }, { status: 200 })
    }

    // 4) Ensure Stripe customer exists (auto-repair)
    let customerId = (sub?.stripe_customer_id ?? '').trim()

    async function createAndPersistCustomer() {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { user_id: userId },
      })

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

    // 5) Create Checkout Session (subscription)
    const origin = getOrigin(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      // important for webhook
      metadata: {
        kind: 'pro',
        user_id: userId,
      },
      // optional
      client_reference_id: userId,
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'No checkout URL returned' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? 'Server error')
        : 'Server error'

    console.error('pro/checkout error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}