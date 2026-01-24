// app/api/mark-paid/route.ts
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
  const k = (process.env.RESEND_API_KEY ?? '').trim()
  if (!k) throw new Error('Missing RESEND_API_KEY env var')
  return new Resend(k)
}

function unixToIso(sec: unknown): string | null {
  if (typeof sec === 'number' && Number.isFinite(sec) && sec > 0) return new Date(sec * 1000).toISOString()
  if (typeof sec === 'string') {
    const n = Number(sec)
    if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString()
  }
  return null
}

function safeBool(v: unknown): boolean {
  return v === true
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
    const sessionId = String(body?.session_id ?? '').trim()
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

    const nowIso = new Date().toISOString()

    // 🔒 Guardrail: must be Checkout Session OR internal Pro bypass
    if (!sessionId.startsWith('cs_') && !sessionId.startsWith('pro_')) {
      return NextResponse.json(
        { error: 'Invalid session_id. Expected Checkout Session (cs_) or pro_*' },
        { status: 400 }
      )
    }

    // 1) ✅ Pro-bypass (internal) => mark link paid, (optional) notify once
    if (sessionId.startsWith('pro_')) {
      const code = sessionId.replace(/^pro_/, '').trim()
      if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

      const { data: updated, error: updErr } = await supabaseAdmin
        .from('file_links')
        .update({
          paid: true,
          paid_at: nowIso,
          paid_session_id: sessionId,
        })
        .eq('code', code)
        .or(`paid_session_id.is.null,paid_session_id.eq.${sessionId}`)
        .select('code, paid_notified_at')
        .maybeSingle()

      if (updErr) throw new Error(updErr.message)

      // Email once (optional)
      const adminTo = (process.env.ADMIN_REPORT_EMAIL ?? '').trim()
      if (adminTo && updated && !updated.paid_notified_at) {
        const resend = getResend()
        const from = (process.env.EMAIL_FROM ?? 'FilePay <onboarding@resend.dev>').trim()

        await resend.emails.send({
          from,
          to: [adminTo],
          subject: '💰 New payment on FilePay',
          html: `
            <h2>New payment received</h2>
            <p><b>Type:</b> Pro bypass (no checkout)</p>
            <p><b>Code:</b> ${updated.code}</p>
            <p><b>Session:</b> ${sessionId}</p>
            <p><b>Date:</b> ${nowIso}</p>
          `,
        })

        await supabaseAdmin
          .from('file_links')
          .update({ paid_notified_at: nowIso })
          .eq('code', updated.code)
          .eq('paid_session_id', sessionId)
      }

      return NextResponse.json({ ok: true, paid: true, code: updated?.code ?? code }, { status: 200 })
    }

    // 2) Retrieve Checkout Session (Stripe)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Detect subscription checkout
    const hasSubId = typeof (session as any).subscription === 'string'
    const hasUserId =
      typeof (session as any).metadata?.user_id === 'string' &&
      (session as any).metadata.user_id.trim().length > 0

    const isSubscription = (session as any).mode === 'subscription' || hasSubId || hasUserId

    // 2a) ✅ Subscription => activate Pro (and optionally email once using pro_notified_at)
    if (isSubscription) {
      const userId = String((session as any).metadata?.user_id ?? '').trim()
      if (!userId) return NextResponse.json({ error: 'Missing user_id in session metadata' }, { status: 400 })

      const subId = typeof (session as any).subscription === 'string' ? (session as any).subscription : null
      const custId = typeof (session as any).customer === 'string' ? (session as any).customer : null

      let currentPeriodEndIso: string | null = null
      let cancelAtPeriodEnd = false

      if (subId) {
        const subRes = await stripe.subscriptions.retrieve(subId)
        if ('deleted' in subRes && (subRes as any).deleted) {
          currentPeriodEndIso = null
          cancelAtPeriodEnd = true
        } else {
          const sub = subRes as Stripe.Subscription
          currentPeriodEndIso = unixToIso((sub as any).current_period_end)
          cancelAtPeriodEnd =
            safeBool((sub as any).cancel_at_period_end) ||
            (typeof (sub as any).cancel_at === 'number' && (sub as any).cancel_at > 0)
        }
      }

      const { error: upErr } = await supabaseAdmin
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

      if (upErr) throw new Error(upErr.message)

      // ✅ Optional: email Pro activation ONCE (uses subscriptions.pro_notified_at)
      const adminTo = (process.env.ADMIN_REPORT_EMAIL ?? '').trim()
      if (adminTo) {
        const { data: subRow } = await supabaseAdmin
          .from('subscriptions')
          .select('pro_notified_at')
          .eq('user_id', userId)
          .maybeSingle()

        if (subRow && !subRow.pro_notified_at) {
          const resend = getResend()
          const from = (process.env.EMAIL_FROM ?? 'FilePay <onboarding@resend.dev>').trim()

          await resend.emails.send({
            from,
            to: [adminTo],
            subject: '✨ New Pro subscription on FilePay',
            html: `
              <h2>Pro subscription activated</h2>
              <p><b>User:</b> ${userId}</p>
              <p><b>Stripe Subscription:</b> ${subId ?? '—'}</p>
              <p><b>Stripe Customer:</b> ${custId ?? '—'}</p>
              <p><b>Current period end:</b> ${currentPeriodEndIso ?? '—'}</p>
              <p><b>Cancel at period end:</b> ${cancelAtPeriodEnd ? 'Yes' : 'No'}</p>
              <p><b>Checkout Session:</b> ${sessionId}</p>
              <p><b>Date:</b> ${nowIso}</p>
            `,
          })

          await supabaseAdmin
            .from('subscriptions')
            .update({ pro_notified_at: nowIso })
            .eq('user_id', userId)
        }
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

    // 2b) ✅ One-time payment => mark file link as paid (idempotent + email once)
    let code = String((session as any)?.metadata?.code ?? '').trim()

    // Fallback: PaymentIntent metadata
    if (!code && typeof (session as any).payment_intent === 'string') {
      const pi = await stripe.paymentIntents.retrieve((session as any).payment_intent)
      code = String(pi.metadata?.code ?? '').trim()
    }

    if (!code) return NextResponse.json({ error: 'Missing code in session metadata' }, { status: 400 })

    // Update + return row so we can decide about emailing
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('file_links')
      .update({
        paid: true,
        paid_at: nowIso,
        paid_session_id: sessionId,
      })
      // allow first set OR retry with same session_id
      .eq('code', code)
      .or(`paid_session_id.is.null,paid_session_id.eq.${sessionId}`)
      .select('code, paid_session_id, paid_notified_at')
      .maybeSingle()

    if (updErr) throw new Error(updErr.message)
    if (!updated?.code) return NextResponse.json({ error: 'Link not found' }, { status: 404 })

    // ✅ Send email once (only if admin email configured)
    const adminTo = (process.env.ADMIN_REPORT_EMAIL ?? '').trim()
    if (adminTo && !updated.paid_notified_at) {
      const resend = getResend()
      const from = (process.env.EMAIL_FROM ?? 'FilePay <onboarding@resend.dev>').trim()

      await resend.emails.send({
        from,
        to: [adminTo],
        subject: '💰 New payment on FilePay',
        html: `
          <h2>New payment received</h2>
          <p><b>Type:</b> One-time link</p>
          <p><b>Code:</b> ${updated.code}</p>
          <p><b>Checkout Session:</b> ${sessionId}</p>
          <p><b>Date:</b> ${nowIso}</p>
        `,
      })

      // mark notified (also idempotent)
      await supabaseAdmin
        .from('file_links')
        .update({ paid_notified_at: nowIso })
        .eq('code', updated.code)
        .eq('paid_session_id', sessionId)
        .is('paid_notified_at', null)
    }

    return NextResponse.json({ ok: true, paid: true, code: updated.code }, { status: 200 })
  } catch (err: any) {
    console.error('mark-paid error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}