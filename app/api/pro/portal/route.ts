import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function mustEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function getOrigin(req: Request) {
  return req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

export async function POST(req: Request) {
  const stripe = new Stripe(mustEnv('STRIPE_SECRET_KEY'), { apiVersion: '2025-12-15.clover' })

  const supabaseAdmin = createClient(
    mustEnv('SUPABASE_URL'),
    mustEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  )

  try {
    const priceId = (process.env.STRIPE_PRO_PRICE_ID ?? '').trim()
    if (!priceId) {
      return NextResponse.json({ error: 'Missing STRIPE_PRO_PRICE_ID env var' }, { status: 500 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
    if (!token) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })

    const user = userData.user

    const origin = getOrigin(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (err: any) {
    console.error('pro checkout error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}