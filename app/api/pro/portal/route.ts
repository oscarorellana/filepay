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
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
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

    const { data: userRes, error: userErr } =
      await supabaseAdmin.auth.getUser(token)

    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = userRes.user.id

    const { data: row } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    const customerId = row?.stripe_customer_id
    if (!customerId) {
      return NextResponse.json(
        { error: 'No Stripe customer for user' },
        { status: 400 }
      )
    }

    const stripe = getStripe()

    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000'

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
      configuration: process.env.STRIPE_BILLING_PORTAL_CONFIG_ID, // 🔥 THIS
    })

    return NextResponse.json({ url: portal.url })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json(
      { error: err?.message ?? 'Server error' },
      { status: 500 }
    )
  }
}