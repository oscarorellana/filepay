import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

function getResend() {
  const key = (process.env.RESEND_API_KEY ?? '').trim()
  if (!key) throw new Error('Missing RESEND_API_KEY env var')
  return new Resend(key)
}

function getAdminEmail() {
  const to = (process.env.ADMIN_REPORT_EMAIL ?? '').trim()
  if (!to) throw new Error('Missing ADMIN_REPORT_EMAIL env var')
  return to
}

function getEmailFrom() {
  // Si tienes un dominio luego, cambia a payments@filepay.com
  return (process.env.EMAIL_FROM ?? 'FilePay <payments@filepay.vercel.app>').trim()
}

function unixToIso(sec: unknown): string | null {
  if (typeof sec === 'number' && Number.isFinite(sec) && sec > 0) return new Date(sec * 1000).toISOString()
  if (typeof sec === 'string') {
    const n = Number(sec)
    if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString()
  }
  return null
}

async function safeSendPaymentEmail(args: {
  subject: string
  html: string
}) {
  // Best-effort: NO rompas el pago si Resend falla.
  try {
    const resend = getResend()
    const to = getAdminEmail()
    const from = getEmailFrom()

    await resend.emails.send({
      from,
      to: [to],
      subject: args.subject,
      html: args.html,
    })
  } catch (e) {
    console.error('Payment email failed:', e)
  }
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

    // ------------------------------------------------------------------
    // 1) ✅ Pro-bypass (internal): session_id = pro_<CODE>
    // ------------------------------------------------------------------
    if (sessionId.startsWith('pro_')) {
      const code = sessionId.replace(/^pro_/, '').trim()
      if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

      // Idempotente + evita múltiples correos:
      // - actualiza paid=true
      // - guarda paid_session_id si está null o es este mismo
      // - SOLO enviamos correo si esta update afectó filas
      const { data, error } = await supabaseAdmin
        .from('file_links')
        .update({
          paid: true,
          paid_at: nowIso,
          paid_session_id: sessionId,
          paid_notified_at: nowIso, // marca notificado
        })
        .eq('code', code)
        .or(`paid_session_id.is.null,paid_session_id.eq.${sessionId}`)
        .select('code')
        .limit(1)

      if (error) throw new Error(error.message)

      const updated = Array.isArray(data) && data.length > 0
      if (updated) {
        await safeSendPaymentEmail({
          subject: '💰 FilePay: Pro bypass finalized',
          html: `
            <h2>Payment finalized</h2>
            <p><b>Type:</b> Pro bypass (internal)</p>
            <p><b>Code:</b> ${code}</p>
            <p><b>Session:</b> ${sessionId}</p>
            <p><b>Date:</b> ${nowIso}</p>
          `,
        })
      }

      return NextResponse.json({ ok: true, paid: true, code, pro: true }, { status: 200 })
    }

    // ------------------------------------------------------------------
    // 2) Retrieve Checkout Session
    // ------------------------------------------------------------------
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // ✅ Stronger detection for subscription checkouts
    const hasSubId = typeof (session as any).subscription === 'string'
    const hasUserId =
      typeof (session as any).metadata?.user_id === 'string' &&
      (session as any).metadata.user_id.trim().length > 0

    const isSubscription = (session as any).mode === 'subscription' || hasSubId || hasUserId

    // ------------------------------------------------------------------
    // 2a) ✅ Subscription => activate Pro
    // ------------------------------------------------------------------
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

      // Upsert Pro + idempotencia de notificación:
      // - enviamos email SOLO si pro_notified_at era null (primera vez) o si quieres cuando renueva.
      // Para eso: primero leemos pro_notified_at.
      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('pro_notified_at')
        .eq('user_id', userId)
        .maybeSingle()

      const alreadyNotified = Boolean((existing as any)?.pro_notified_at)

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
            // solo setea pro_notified_at si NO existía (si ya existía, lo dejamos)
            ...(alreadyNotified ? {} : { pro_notified_at: nowIso }),
          },
          { onConflict: 'user_id' }
        )

      if (error) throw new Error(error.message)

      if (!alreadyNotified) {
        await safeSendPaymentEmail({
          subject: '💰 FilePay: Pro subscription activated',
          html: `
            <h2>Pro activated ✅</h2>
            <p><b>User ID:</b> ${userId}</p>
            <p><b>Stripe sub:</b> ${subId ?? '—'}</p>
            <p><b>Stripe customer:</b> ${custId ?? '—'}</p>
            <p><b>Renews:</b> ${currentPeriodEndIso ?? '—'}</p>
            <p><b>Cancel at period end:</b> ${cancelAtPeriodEnd ? 'Yes' : 'No'}</p>
            <p><b>Date:</b> ${nowIso}</p>
          `,
        })
      }

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

    // ------------------------------------------------------------------
    // 2b) ✅ One-time payment => mark file link as paid (IDEMPOTENT)
    // ------------------------------------------------------------------
    let code = ((session as any)?.metadata?.code ?? '').trim()

    // Fallback: PaymentIntent metadata
    if (!code && typeof (session as any).payment_intent === 'string') {
      const pi = await stripe.paymentIntents.retrieve((session as any).payment_intent)
      code = (pi.metadata?.code ?? '').trim()
    }

    if (!code) {
      return NextResponse.json({ error: 'Missing code in session metadata' }, { status: 400 })
    }

    // Idempotente y evita re-email:
    // - Solo actualiza si paid_session_id es null o ya es este sessionId
    // - Solo seteamos paid_notified_at si era null (primera vez)
    const { data, error: upErr } = await supabaseAdmin
      .from('file_links')
      .update({
        paid: true,
        paid_at: nowIso,
        paid_session_id: sessionId,
        paid_notified_at: nowIso,
      })
      .eq('code', code)
      .or(`paid_session_id.is.null,paid_session_id.eq.${sessionId}`)
      .select('code, paid_notified_at')
      .limit(1)

    if (upErr) throw new Error(upErr.message)

    const updated = Array.isArray(data) && data.length > 0
    if (updated) {
      await safeSendPaymentEmail({
        subject: '💰 FilePay: New one-time link payment',
        html: `
          <h2>One-time link payment ✅</h2>
          <p><b>Code:</b> ${code}</p>
          <p><b>Session:</b> ${sessionId}</p>
          <p><b>Date:</b> ${nowIso}</p>
        `,
      })
    }

    return NextResponse.json({ ok: true, paid: true, code }, { status: 200 })
  } catch (err: any) {
    console.error('mark-paid error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}