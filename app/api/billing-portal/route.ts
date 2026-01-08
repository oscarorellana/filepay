import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mustEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export async function POST(req: Request) {
  
  // Stripe is initialized inside the handler (prevents build-time crashes)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
  })

try {
    // ✅ Read env vars at request-time (not build-time)
    const STRIPE_SECRET_KEY = mustEnv('STRIPE_SECRET_KEY')
    const SUPABASE_URL = mustEnv('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = mustEnv('SUPABASE_SERVICE_ROLE_KEY')
    const NEXT_PUBLIC_SITE_URL = mustEnv('NEXT_PUBLIC_SITE_URL')

// Stripe init moved inside POST() for Vercel build safety

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    // ✅ Auth token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    // ✅ Validate user
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
    }

    const userId = userData.user.id

    // ✅ Get stripe customer id from subscriptions table
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (rowErr) throw new Error(rowErr.message)

    const customerId = (row?.stripe_customer_id ?? '').trim()
    if (!customerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this user yet.' },
        { status: 400 }
      )
    }

    // ✅ Create Stripe Billing Portal session
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${NEXT_PUBLIC_SITE_URL}/billing`,
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