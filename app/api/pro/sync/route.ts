import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Stripe init moved inside POST() for Vercel build safety

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function parseUnixSecondsToIso(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(v * 1000).toISOString()
  }
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

/**
 * POST /api/pro/sync
 * Headers: Authorization: Bearer <supabase_access_token>
 *
 * Syncs Stripe subscription -> Supabase "subscriptions" row.
 * Important: "schedule cancel" may keep status=active but set cancel_at_period_end=true
 * (or sometimes cancel_at set as unix seconds).
 */
export async function POST(req: Request) {
  
  // Stripe is initialized inside the handler (prevents build-time crashes)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
  })

try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    // Validate user
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
    }

    const userId = userData.user.id

    // Get subscription row (source of truth for which Stripe sub to sync)
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (rowErr) throw new Error(rowErr.message)

    const subId = (row?.stripe_subscription_id ?? '').trim()
    if (!subId) {
      return NextResponse.json(
        { ok: true, message: 'No stripe_subscription_id found. Nothing to sync.' },
        { status: 200 }
      )
    }

    // Fetch Stripe subscription
    const sub: any = await stripe.subscriptions.retrieve(subId)

    const stripeStatusRaw = sub?.status
    const stripeStatus = String(stripeStatusRaw ?? 'unknown')

    // Stripe may return DeletedSubscription; read safely
    const cancelAtPeriodEndRaw =
      sub && typeof sub === 'object' && !('deleted' in sub)
        ? (sub.cancel_at_period_end as unknown)
        : null

    const cancelAtRaw =
      sub && typeof sub === 'object' && !('deleted' in sub)
        ? (sub.cancel_at as unknown)
        : null

    // ✅ schedule-cancel detection:
    // - cancel_at_period_end (boolean)
    // - OR cancel_at (unix seconds) > 0
    const cancelAtPeriodEnd =
      parseBool(cancelAtPeriodEndRaw) ||
      (typeof cancelAtRaw === 'number' && Number.isFinite(cancelAtRaw) && cancelAtRaw > 0)

const currentPeriodEndRaw =
  sub && typeof sub === 'object' && !('deleted' in sub)
    ? (sub.current_period_end as unknown)
    : null

const currentPeriodEndFromCpe = parseUnixSecondsToIso(currentPeriodEndRaw)

// ✅ fallback: if Stripe didn't give current_period_end but we have cancel_at, use cancel_at as "ends"
let currentPeriodEnd = currentPeriodEndFromCpe
if (!currentPeriodEnd) {
  currentPeriodEnd = parseUnixSecondsToIso(cancelAtRaw)
}

    const stripeCustomerId =
      typeof sub?.customer === 'string' ? sub.customer : (row?.stripe_customer_id ?? null)

    // Map Stripe status -> DB status
    let dbStatus: string = stripeStatus
    if (stripeStatus === 'active' || stripeStatus === 'trialing') dbStatus = 'active'
    if (stripeStatus === 'canceled') dbStatus = 'canceled'

    // Plan logic:
    // - While active (even if cancel_at_period_end=true), user is still PRO until period end.
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
        plan,
        status: dbStatus,
        stripe_status: stripeStatus,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_end: currentPeriodEnd,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subId,

        // ✅ debug mínimo (para ver qué vino de Stripe)
        debug: {
          cancelAtPeriodEndRaw,
          cancelAtRaw,
          currentPeriodEndRaw,
          statusRaw: stripeStatusRaw,
          keys_sample: Object.keys(sub ?? {}).slice(0, 30),
        },
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('pro sync error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}