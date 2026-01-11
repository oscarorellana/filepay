import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY env var')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL ?? '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!url) throw new Error('Missing SUPABASE_URL env var')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var')
  return createClient(url, key, { auth: { persistSession: false } })
}

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
 * Creates a Stripe Checkout Session (subscription)
 * Reuses stripe_customer_id when present and blocks duplicates.
 */
export async function POST(req: Request) {
  try {
    const stripe = getStripe()
    const supabaseAdmin = getSupabaseAdmin()

    const priceId = (process.env.STRIPE_PRO_PRICE_ID ?? '').trim()
    if (!priceId) {
      return NextResponse.json(
        { error: 'Missing STRIPE_PRO_PRICE_ID env var' },
        { status: 500 }
      )
    }

    // 1) Auth
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
    }

    const user = userRes.user
    const userId = user.id
    const email = (user.email ?? '').trim()

    const origin = getOrigin(req)
    const successUrl = `${origin}/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/pricing`

    // 2) Read current subscription row (to reuse customer)
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (rowErr) throw new Error(rowErr.message)

    const customerId = (row?.stripe_customer_id ?? '').trim() || null

    // 3) If we already have a customer, block duplicate active/trialing subs
    if (customerId) {
      const existing = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 25,
      })

      const hasActiveLike = existing.data.some((s) =>
        ['active', 'trialing', 'past_due', 'unpaid'].includes(s.status)
      )

      if (hasActiveLike) {
        // Instead of creating a new subscription, send them to the portal
        const portal = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${origin}/billing`,
        })

        return NextResponse.json(
          {
            error: 'You already have an active Pro subscription.',
            portal_url: portal.url,
            already_pro: true,
          },
          { status: 409 }
        )
      }
    }

    // 4) Create Checkout Session (subscription)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,

      // ✅ IMPORTANT: reuse the same Stripe customer if we have one
      ...(customerId
        ? { customer: customerId }
        : email
          ? { customer_email: email }
          : {}),

      // Useful for debugging / mapping
      client_reference_id: userId,
      metadata: {
        user_id: userId,
        kind: 'pro',
      },

      // Also attach metadata to the subscription itself
      subscription_data: {
        metadata: {
          user_id: userId,
          kind: 'pro',
        },
      },
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err: any) {
    console.error('pro checkout error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Server error' },
      { status: 500 }
    )
  }
}