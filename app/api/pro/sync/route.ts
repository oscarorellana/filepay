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

function unixToIso(sec: unknown): string | null {
  if (typeof sec === 'number' && Number.isFinite(sec) && sec > 0) {
    return new Date(sec * 1000).toISOString()
  }
  if (typeof sec === 'string') {
    const n = Number(sec)
    if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString()
  }
  return null
}

function boolish(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.toLowerCase() === 'true'
  return Boolean(v)
}

/**
 * Stripe sometimes does NOT include current_period_end at the top-level.
 * In newer shapes, it can live under subscription.items.data[0].current_period_end
 */
function getCurrentPeriodEndUnix(sub: any): number | null {
  const top = sub?.current_period_end
  if (typeof top === 'number' && Number.isFinite(top) && top > 0) return top

  const itemEnd = sub?.items?.data?.[0]?.current_period_end
  if (typeof itemEnd === 'number' && Number.isFinite(itemEnd) && itemEnd > 0) return itemEnd

  return null
}

/**
 * POST /api/pro/sync
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Sync Stripe subscription -> Supabase subscriptions row
 * Guarantees current_period_end gets stored when available.
 */
export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const stripe = getStripe()

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })

    // Validate user
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
    }

    const userId = userRes.user.id

    // Read DB row (source of truth for stripe IDs)
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (rowErr) throw new Error(rowErr.message)

    const subId = (row?.stripe_subscription_id ?? '').trim()
    if (!subId) {
      return NextResponse.json(
        { ok: true, message: 'No stripe_subscription_id. Nothing to sync.' },
        { status: 200 }
      )
    }

    // Retrieve subscription from Stripe (cast avoids TS "Response<Subscription>" pain)
    const subAny = (await stripe.subscriptions.retrieve(subId)) as any

    // Handle deleted subs (rare but possible)
    if (subAny?.deleted) {
      const { error: upErr } = await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan: row?.plan ?? 'free',
            status: 'canceled',
            stripe_customer_id: row?.stripe_customer_id ?? null,
            stripe_subscription_id: subId,
            current_period_end: null,
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

      if (upErr) throw new Error(upErr.message)

      return NextResponse.json(
        {
          ok: true,
          plan: row?.plan ?? 'free',
          status: 'canceled',
          stripe_status: 'deleted',
          current_period_end: null,
          cancel_at_period_end: true,
          stripe_customer_id: row?.stripe_customer_id ?? null,
          stripe_subscription_id: subId,
        },
        { status: 200 }
      )
    }

    const stripeStatus = String(subAny?.status ?? 'unknown')

    // ✅ FIX: get period end from top-level OR from items[0]
    const periodEndUnix = getCurrentPeriodEndUnix(subAny)
    const currentPeriodEndIso = unixToIso(periodEndUnix)

    const cancelAtPeriodEnd =
      boolish(subAny?.cancel_at_period_end) ||
      (typeof subAny?.cancel_at === 'number' && subAny.cancel_at > 0)

    // Customer id (prefer Stripe, fallback DB)
    const stripeCustomerId =
      typeof subAny?.customer === 'string'
        ? (subAny.customer as string)
        : ((row?.stripe_customer_id ?? '') as string) || null

    // Map Stripe status -> DB status
    let dbStatus = stripeStatus
    if (stripeStatus === 'active' || stripeStatus === 'trialing') dbStatus = 'active'
    if (stripeStatus === 'canceled') dbStatus = 'canceled'
    if (stripeStatus === 'incomplete' || stripeStatus === 'incomplete_expired') dbStatus = 'incomplete'
    if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') dbStatus = 'past_due'

    // Plan rule
    const plan = dbStatus === 'active' ? 'pro' : (row?.plan ?? 'free')

    const { error: upErr } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan,
          status: dbStatus,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subId,
          current_period_end: currentPeriodEndIso, // ✅ now works even when top-level missing
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upErr) throw new Error(upErr.message)

    return NextResponse.json(
      {
        ok: true,
        plan,
        status: dbStatus,
        stripe_status: stripeStatus,
        current_period_end: currentPeriodEndIso,
        cancel_at_period_end: cancelAtPeriodEnd,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subId,

        // tiny optional debug (safe to remove)
        debug: {
          period_end_unix_top: subAny?.current_period_end ?? null,
          period_end_unix_item: subAny?.items?.data?.[0]?.current_period_end ?? null,
        },
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('pro sync error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}