import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function mustEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

function parseUnixSecondsToIso(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v * 1000).toISOString()
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString()
  }
  return null
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.toLowerCase() === 'true'
  return Boolean(v)
}

export async function POST(req: Request) {
  const stripe = new Stripe(mustEnv('STRIPE_SECRET_KEY'), { apiVersion: '2025-12-15.clover' })

  const supabaseAdmin = createClient(
    mustEnv('SUPABASE_URL'),
    mustEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  )

  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })

    const userId = userData.user.id

    const { data: row, error: rowErr } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (rowErr) throw new Error(rowErr.message)

    const subId = (row?.stripe_subscription_id ?? '').trim()
    const customerId = (row?.stripe_customer_id ?? '').trim()

    if (!subId && !customerId) {
      return NextResponse.json(
        { ok: true, message: 'No stripe_customer_id or stripe_subscription_id. Nothing to sync.' },
        { status: 200 }
      )
    }

    // ✅ prefer subscription id; if missing, fall back to latest subscription on customer
    let usedFallback = false
    let reason = 'Used stripe_subscription_id from DB'
    let stripeSub: any = null
    let finalSubId = subId

    if (subId) {
      stripeSub = await stripe.subscriptions.retrieve(subId)
    } else {
      usedFallback = true
      reason = 'Used latest subscription from stripe_customer_id'
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 1,
      })
      stripeSub = list.data?.[0] ?? null
      finalSubId = stripeSub?.id ?? ''
      if (!stripeSub) {
        return NextResponse.json(
          { ok: true, message: 'No Stripe subscription found for customer.' },
          { status: 200 }
        )
      }
    }

    const stripeStatusRaw = stripeSub?.status
    const stripeStatus = String(stripeStatusRaw ?? 'unknown')

    const cancelAtPeriodEndRaw = stripeSub?.cancel_at_period_end
    const cancelAtPeriodEnd = parseBool(cancelAtPeriodEndRaw)

    const currentPeriodEndRaw = stripeSub?.current_period_end
    const currentPeriodEnd = parseUnixSecondsToIso(currentPeriodEndRaw)

    const stripeCustomerId =
      typeof stripeSub?.customer === 'string' ? stripeSub.customer : (row?.stripe_customer_id ?? null)

    let dbStatus: string = stripeStatus
    if (stripeStatus === 'active' || stripeStatus === 'trialing') dbStatus = 'active'
    if (stripeStatus === 'canceled') dbStatus = 'canceled'

    // If it’s scheduled to cancel, it can still be active until period end — keep plan=pro
    const plan = dbStatus === 'active' ? 'pro' : 'free'

    const { error: upErr } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan,
          status: dbStatus,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: finalSubId || null,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upErr) throw new Error(upErr.message)

    return NextResponse.json(
      {
        ok: true,
        used_fallback: usedFallback,
        reason,
        plan,
        status: dbStatus,
        stripe_status: stripeStatus,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_end: currentPeriodEnd,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: finalSubId || null,
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('pro sync error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}