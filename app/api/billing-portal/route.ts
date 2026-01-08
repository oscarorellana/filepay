import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// ✅ avoids “collect page data” / static weirdness in some builds
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  // IMPORTANT: don’t throw at module scope; only throw when the route is called.
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY env var')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    // Validate user
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
    }

    const userId = userRes.user.id

    // Get stripe_customer_id from DB
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (rowErr) throw new Error(rowErr.message)

    const customerId = (row?.stripe_customer_id ?? '').trim()
    if (!customerId) {
      return NextResponse.json(
        { error: 'No stripe_customer_id found for this user.' },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000'

    const returnUrl = `${origin}/billing`

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: portal.url }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Server error' },
      { status: 500 }
    )
  }
}