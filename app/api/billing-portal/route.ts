import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-12-15.clover',
})

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })

    // Verify user via Supabase Auth
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = userRes.user.id

    // Get stripe_customer_id from your subscriptions table
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, plan, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (subErr) throw new Error(subErr.message)

    const customerId = (subRow?.stripe_customer_id ?? '').trim()
    if (!customerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this user yet.' },
        { status: 400 }
      )
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000'

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    })

    return NextResponse.json({ url: portal.url }, { status: 200 })
  } catch (err: any) {
    console.error('billing-portal error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Server error' },
      { status: 500 }
    )
  }
}