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

/**
 * POST /api/mark-paid
 * Body: { session_id: string }
 */
export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const stripe = getStripe()

    const body = await req.json().catch(() => ({}))
    const sessionId = (body?.session_id as string | undefined)?.trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    // 1) ✅ Pro-bypass (internal)
    if (sessionId.startsWith('pro_')) {
      const code = sessionId.replace(/^pro_/, '').trim()
      if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

      const { error } = await supabaseAdmin
        .from('file_links')
        .update({ paid: true, paid_at: nowIso })
        .eq('code', code)

      if (error) throw new Error(error.message)

      return NextResponse.json({ ok: true, paid: true, code }, { status: 200 })
    }

    // 2) Retrieve Checkout Session
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // ✅ Stronger detection for subscription checkouts
    const hasSubId = typeof (session as any).subscription === 'string'
    const hasUserId =
      typeof (session as any).metadata?.user_id === 'string' &&
      (session as any).metadata.user_id.trim().length > 0

    const isSubscription =
      (session as any).mode === 'subscription' || hasSubId || hasUserId

    // 2a) ✅ Subscription => activate Pro
    if (isSubscription) {
      const userId = ((session as any).metadata?.user_id ?? '').trim()
      if (!userId) {
        return NextResponse.json({ error: 'Missing user_id in session metadata' }, { status: 400 })
      }

      const subId = typeof (session as any).subscription === 'string' ? (session as any).subscription : null
      const custId = typeof (session as any).customer === 'string' ? (session as any).customer : null

      let currentPeriodEndIso: string | null = null
      let cancelAtPeriodEnd = false

      if (subId) {
        const subRes = await stripe.subscriptions.retrieve(subId)

        if ('deleted' in subRes && subRes.deleted) {
          currentPeriodEndIso = null
          cancelAtPeriodEnd = true
        } else {
          const sub = subRes as Stripe.Subscription
          currentPeriodEndIso = unixToIso((sub as any).current_period_end)
          cancelAtPeriodEnd =
            Boolean((sub as any).cancel_at_period_end) ||
            (typeof (sub as any).cancel_at === 'number' && (sub as any).cancel_at > 0)
        }
      }

      const { error } = await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan: 'pro',
            status: 'active',
            stripe_customer_id: custId,
            stripe_subscription_id: subId,
            current_period_end: currentPeriodEndIso,
            cancel_at_period_end: cancelAtPeriodEnd,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw new Error(error.message)

      return NextResponse.json(
        {
          ok: true,
          pro: true,
          stripe_subscription_id: subId,
          stripe_customer_id: custId,
          current_period_end: currentPeriodEndIso,
          cancel_at_period_end: cancelAtPeriodEnd,
        },
        { status: 200 }
      )
    }
// 2b) ✅ One-time payment => mark file link as paid (IDEMPOTENT)
    // Try session metadata first
    let code = ((session as any)?.metadata?.code ?? '').trim()

    // Fallback: PaymentIntent metadata
    if (!code && typeof (session as any).payment_intent === 'string') {
      const pi = await stripe.paymentIntents.retrieve((session as any).payment_intent)
      code = (pi.metadata?.code ?? '').trim()
    }

    if (!code) {
      return NextResponse.json({ error: 'Missing code in session metadata' }, { status: 400 })
    }

    // ✅ Idempotent finalize:
    // - store paid_session_id so this session cannot re-send email
    // - allow retries with SAME session_id safely
const { error: upErr } = await supabaseAdmin
  .from('file_links')
  .update({
    paid: true,
    paid_at: nowIso,
    paid_session_id: sessionId,
  })
  .eq('code', code)
  .or(`paid_session_id.is.null,paid_session_id.eq.${sessionId}`)

if (upErr) throw new Error(upErr.message)


    return NextResponse.json({ ok: true, paid: true, code }, { status: 200 })
  } catch (err: any) {
    console.error('mark-paid error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}