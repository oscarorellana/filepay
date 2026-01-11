import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

function getResend() {
  const key = (process.env.RESEND_API_KEY ?? '').trim()
  if (!key) throw new Error('Missing RESEND_API_KEY env var')
  return new Resend(key)
}

function getEmailFrom() {
  const from = (process.env.EMAIL_FROM ?? '').trim()
  if (!from) throw new Error('Missing EMAIL_FROM env var')
  return from
}

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

    // 2b) ✅ One-time payment => mark file link as paid (IDEMPOTENT + 1 EMAIL)
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
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('file_links')
      .update({
        paid: true,
        paid_at: nowIso,
        paid_session_id: sessionId,
      })
      .eq('code', code)
      .or(`paid_session_id.is.null,paid_session_id.eq.${sessionId}`)
      .select('code, paid, paid_session_id')
      .maybeSingle()

    if (upErr) throw new Error(upErr.message)

    // If update didn’t happen, it was already finalized by a previous call
    const alreadyFinalized = !updated || (updated.paid_session_id && updated.paid_session_id !== sessionId)
    const shouldSendEmail = !alreadyFinalized && updated?.paid_session_id === sessionId

    // Buyer email from Stripe
    const buyerEmail =
      ((session as any)?.customer_details?.email ?? (session as any)?.customer_email ?? '').trim()

    // Amount info (optional)
    const amountCents = typeof (session as any).amount_total === 'number' ? (session as any).amount_total : null
    const currencyRaw = typeof (session as any).currency === 'string' ? (session as any).currency : 'usd'
    const currency = currencyRaw.toUpperCase()
    const amountLabel = amountCents != null ? `${(amountCents / 100).toFixed(2)} ${currency}` : null

    // ✅ Send exactly ONE email (best-effort)
    if (shouldSendEmail) {
      try {
        console.log('Checkout email:', (session as any)?.customer_details?.email, (session as any)?.customer_email)

        if (buyerEmail) {
          const resend = getResend()
          const from = getEmailFrom()

          const origin =
            req.headers.get('origin') ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            'http://localhost:3000'

          const downloadUrl = `${origin}/dl/${encodeURIComponent(code)}`

          await resend.emails.send({
            from,
            to: buyerEmail,
            subject: 'Your FilePay link is ready',
            html: `
              <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5;">
                <h2 style="margin:0 0 8px;">Payment confirmed ✅</h2>
                <p style="margin:0 0 12px;">
                  ${amountLabel ? `Amount paid: <b>${amountLabel}</b><br/>` : ''}
                  Your download link is ready:
                </p>
                <p style="margin:0 0 16px;">
                  <a href="${downloadUrl}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#fff; text-decoration:none;">
                    Download file
                  </a>
                </p>
                <p style="margin:0; color:#6b7280; font-size:12px;">
                  Link code: <b>${code}</b>
                </p>
              </div>
            `,
          })
        } else {
          console.warn('No buyer email found on Stripe session; email not sent.')
        }
      } catch (e) {
        console.error('Resend send failed (non-fatal):', e)
      }
    }

    return NextResponse.json({ ok: true, paid: true, code }, { status: 200 })
  } catch (err: any) {
    console.error('mark-paid error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}