// app/api/pro/portal/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function mustEnv(name: string) {
  const v = (process.env[name] ?? '').trim()
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function getStripe() {
  const key = mustEnv('STRIPE_SECRET_KEY')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

function getOrigin(req: Request) {
  return (
    req.headers.get('origin') ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() ||
    'http://localhost:3000'
  )
}

const supabaseAdmin = createClient(
  mustEnv('SUPABASE_URL'),
  mustEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = userRes.user.id
    const origin = getOrigin(req)

    // Look up Stripe customer for this user (if any)
    const { data: row, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (subErr) {
      return NextResponse.json({ error: subErr.message }, { status: 500 })
    }

    const customerId = (row?.stripe_customer_id ?? '').trim()

    // ✅ If no customer yet => send user to Pricing (Upgrade)
    if (!customerId) {
      return NextResponse.json({
        url: `${origin}/pricing`,
        reason: 'no_customer',
      })
    }

    const stripe = getStripe()

    const portalConfigId = (process.env.STRIPE_BILLING_PORTAL_CONFIG_ID ?? '').trim()

    try {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/billing`,
        ...(portalConfigId ? { configuration: portalConfigId } : {}),
      })

      return NextResponse.json({ url: portal.url })
    } catch (e: any) {
      // ✅ If Stripe says customer doesn't exist, clean it and send to Pricing
      const msg = (e?.message ?? '').toLowerCase()
      if (msg.includes('no such customer')) {
        const { error: cleanupErr } = await supabaseAdmin
  .from('subscriptions')
  .update({ stripe_customer_id: null })
  .eq('user_id', userId)
  .eq('stripe_customer_id', customerId)

if (cleanupErr) {
  console.warn('Failed to cleanup invalid stripe_customer_id:', cleanupErr.message)
}

        return NextResponse.json({
          url: `${origin}/pricing`,
          reason: 'customer_not_found',
        })
      }

      throw e
    }
  } catch (err: any) {
    console.error('portal error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Server error' },
      { status: 500 }
    )
  }
}