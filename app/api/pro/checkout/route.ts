import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-12-15.clover',
})

// Server-side Supabase (Service Role)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function getOrigin(req: Request) {
  return (
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  )
}

/**
 * POST /api/pro/checkout
 * Requires Authorization: Bearer <supabase_access_token>
 *
 * Creates a Stripe Checkout Session in SUBSCRIPTION mode
 * using STRIPE_PRO_PRICE_ID (recurring price).
 */
export async function POST(req: Request) {
  try {
    const priceId = (process.env.STRIPE_PRO_PRICE_ID ?? '').trim()
    if (!priceId) {
      return NextResponse.json(
        { error: 'Missing STRIPE_PRO_PRICE_ID env var' },
        { status: 500 }
      )
    }

    // 1) Verify logged-in user from Supabase access token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
    }

    const user = userData.user
    const userId = user.id
    const email = user.email ?? null

    // 2) If we already have a Stripe customer for this user, reuse it
    const { data: subRow } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, status, plan')
      .eq('user_id', userId)
      .maybeSingle()

    const existingCustomerId =
      (subRow?.stripe_customer_id ?? '').trim() || null

    // Optional: if you want to block checkout when already Pro active
    if (subRow?.plan === 'pro' && subRow?.status === 'active') {
      return NextResponse.json(
        { error: 'You already have an active Pro subscription.' },
        { status: 400 }
      )
    }

    // 3) Create Stripe Checkout session (subscription)
    const origin = getOrigin(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],

      // Reuse customer if we have it; otherwise prefill email
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : email
          ? { customer_email: email }
          : {}),

      // This is IMPORTANT: your /api/mark-paid uses session.metadata.user_id
      metadata: {
        user_id: userId,
        plan: 'pro',
        email: email ?? '',
      },

      // Where to go after checkout
      // (Keep it simple: return to /pricing and let UI show a success message later)
      success_url: `${origin}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=1`,

      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err: any) {
    console.error('pro checkout error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Stripe error' },
      { status: 500 }
    )
  }
}