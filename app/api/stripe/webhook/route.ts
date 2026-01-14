// app/api/stripe/webhook/route.ts
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

function getWebhookSecret() {
  const whsec = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim()
  if (!whsec) throw new Error('Missing STRIPE_WEBHOOK_SECRET env var')
  return whsec
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

function getEmailFrom() {
  const from = (process.env.EMAIL_FROM ?? '').trim()
  if (!from) throw new Error('Missing EMAIL_FROM env var')
  return from
}

function getSiteOrigin(req: Request) {
  // Prefer env (Vercel) for consistency
  const envOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (envOrigin) return envOrigin.replace(/\/+$/, '')
  // Fallback: try request origin
  const hdrOrigin = (req.headers.get('origin') ?? '').trim()
  if (hdrOrigin) return hdrOrigin.replace(/\/+$/, '')
  // Last resort
  return 'https://filepay.vercel.app'
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

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const resend = getResend()
  const from = getEmailFrom()

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  })
}

// --- Payment (one-time) => mark file link paid ---
async function markFileLinkPaid({
  stripe,
  supabaseAdmin,
  session,
}: {
  stripe: Stripe
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  session: Stripe.Checkout.Session
}) {
  let code = ((session.metadata?.code ?? '') as string).trim()

  if (!code && typeof session.payment_intent === 'string') {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent)
    code = ((pi.metadata?.code ?? '') as string).trim()
  }

  if (!code) throw new Error('Missing code in session metadata')

  const { error } = await supabaseAdmin
    .from('file_links')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('code', code)

  if (error) throw new Error(error.message)
  return { code }
}

// --- Subscription checkout => activate Pro ---
async function activateProFromCheckout({
  stripe,
  supabaseAdmin,
  session,
}: {
  stripe: Stripe
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  session: Stripe.Checkout.Session
}) {
  const userId = ((session.metadata?.user_id ?? '') as string).trim()
  if (!userId) throw new Error('Missing user_id in session metadata')

  const subId = typeof session.subscription === 'string' ? session.subscription : null
  const custId = typeof session.customer === 'string' ? session.customer : null

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
        boolish((sub as any).cancel_at_period_end) ||
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) throw new Error(error.message)

  return {
    user_id: userId,
    stripe_subscription_id: subId,
    stripe_customer_id: custId,
    current_period_end: currentPeriodEndIso,
    cancel_at_period_end: cancelAtPeriodEnd,
  }
}

// --- Keep Pro status fresh by subscription id (renew/cancel/etc.) ---
async function syncProBySubscriptionId({
  stripe,
  supabaseAdmin,
  stripeSubscriptionId,
}: {
  stripe: Stripe
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  stripeSubscriptionId: string
}) {
  const { data: row, error: rowErr } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle()

  if (rowErr) throw new Error(rowErr.message)
  if (!row?.user_id) return { skipped: true }

  const subRes = await stripe.subscriptions.retrieve(stripeSubscriptionId)

  let stripeStatus = 'unknown'
  let currentPeriodEndIso: string | null = null
  let cancelAtPeriodEnd = false
  let stripeCustomerId: string | null = row.stripe_customer_id

  if ('deleted' in subRes && (subRes as any).deleted) {
    stripeStatus = 'canceled'
    currentPeriodEndIso = null
    cancelAtPeriodEnd = true
  } else {
    const sub = subRes as Stripe.Subscription
    stripeStatus = String((sub as any)?.status ?? 'unknown')
    currentPeriodEndIso = unixToIso((sub as any)?.current_period_end)
    cancelAtPeriodEnd =
      boolish((sub as any)?.cancel_at_period_end) ||
      (typeof (sub as any)?.cancel_at === 'number' && (sub as any).cancel_at > 0)
    stripeCustomerId =
      typeof (sub as any)?.customer === 'string'
        ? ((sub as any).customer as string)
        : stripeCustomerId
  }

  let dbStatus = stripeStatus
  if (stripeStatus === 'active' || stripeStatus === 'trialing') dbStatus = 'active'
  if (stripeStatus === 'canceled') dbStatus = 'canceled'
  if (stripeStatus === 'incomplete' || stripeStatus === 'incomplete_expired') dbStatus = 'incomplete'
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') dbStatus = 'past_due'

  const plan = dbStatus === 'active' ? 'pro' : (row.plan ?? 'free')

  const { error: upErr } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: row.user_id,
        plan,
        status: dbStatus,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        current_period_end: currentPeriodEndIso,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (upErr) throw new Error(upErr.message)

  return {
    user_id: row.user_id,
    plan,
    status: dbStatus,
    stripe_status: stripeStatus,
    current_period_end: currentPeriodEndIso,
    cancel_at_period_end: cancelAtPeriodEnd,
    stripe_customer_id: stripeCustomerId,
  }
}

// --- Idempotency gate (single-source-of-truth) ---
async function alreadyProcessed(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  event: Stripe.Event
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })

  if (error) {
    const msg = (error as any)?.message ?? ''
    const code = (error as any)?.code ?? ''
    if (code === '23505' || msg.toLowerCase().includes('duplicate')) return true
    throw new Error(msg || 'Failed to record stripe event')
  }

  return false
}

async function getCustomerEmail(stripe: Stripe, customerId: string | null): Promise<string> {
  if (!customerId) return ''
  try {
    const c = await stripe.customers.retrieve(customerId)
    if ((c as any)?.deleted) return ''
    const email = String((c as any)?.email ?? '').trim()
    return email
  } catch {
    return ''
  }
}

export async function POST(req: Request) {
  const stripe = getStripe()
  const supabaseAdmin = getSupabaseAdmin()

  try {
    const sig = req.headers.get('stripe-signature')
    if (!sig) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const rawBody = await req.text()
    const whsec = getWebhookSecret()

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, whsec)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err?.message ?? err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // ✅ Skip duplicates (Stripe retries / local+vercel / etc.)
    const duplicate = await alreadyProcessed(supabaseAdmin, event)
    if (duplicate) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }

    const origin = getSiteOrigin(req)

    switch (event.type) {
      /**
       * ✅ Checkout complete (one-time links and subscription starts)
       * We send:
       * - ONE-TIME link email here (download link)
       * - PRO subscribe email here (welcome + renews date)
       */
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const hasSubId = typeof (session as any).subscription === 'string'
        const hasUserId =
          typeof (session as any).metadata?.user_id === 'string' &&
          (session as any).metadata.user_id.trim().length > 0
        const isSubscription = (session as any).mode === 'subscription' || hasSubId || hasUserId

        if (isSubscription) {
          // 1) Update DB
          const out = await activateProFromCheckout({ stripe, supabaseAdmin, session })
          console.log('webhook: pro activated', out)

          // 2) Email user about subscription activation
          try {
            const subId = out.stripe_subscription_id
            const custId = out.stripe_customer_id

            // Best email source: session.customer_details.email, else Stripe customer email
            const emailFromSession = (session.customer_details?.email ?? session.customer_email ?? '').trim()
            const emailFromCustomer = await getCustomerEmail(stripe, custId)
            const to = emailFromSession || emailFromCustomer

            if (!to) {
              console.warn('webhook: pro subscribe email skipped (no email found)')
              break
            }

            // If we can, get fresh dates from Stripe subscription
            let renewIso: string | null = out.current_period_end
            let cancelAtPeriodEnd = Boolean(out.cancel_at_period_end)

            if (subId) {
              const subRes = await stripe.subscriptions.retrieve(subId)
              if (!('deleted' in subRes && (subRes as any).deleted)) {
                const sub = subRes as Stripe.Subscription
                renewIso = unixToIso((sub as any).current_period_end)
                cancelAtPeriodEnd =
                  boolish((sub as any).cancel_at_period_end) ||
                  (typeof (sub as any).cancel_at === 'number' && (sub as any).cancel_at > 0)
              }
            }

            const renewLabel = formatDateShort(renewIso)
            const manageUrl = `${origin}/billing`

            await sendEmail({
              to,
              subject: 'FilePay Pro activated ✅',
              html: `
                <div style="font-family:system-ui;line-height:1.55">
                  <h2 style="margin:0 0 10px;">You’re on Pro ✅</h2>
                  <p style="margin:0 0 10px;">Your Pro subscription is now active.</p>
                  ${
                    renewLabel
                      ? cancelAtPeriodEnd
                        ? `<p style="margin:0 0 10px;"><b>Valid until:</b> ${renewLabel}</p>`
                        : `<p style="margin:0 0 10px;"><b>Renews on:</b> ${renewLabel}</p>`
                      : ''
                  }
                  <p style="margin:0 0 12px;">
                    Manage billing anytime: <a href="${manageUrl}">${manageUrl}</a>
                  </p>
                  <p style="margin:0;font-size:12px;color:#6b7280">If you didn’t request this, reply to this email.</p>
                </div>
              `,
            })

            console.log('webhook: pro subscribe email sent to', to)
          } catch (e) {
            console.error('webhook: pro subscribe email failed (non-fatal)', e)
          }
        } else {
          // One-time link payment
          const { code } = await markFileLinkPaid({ stripe, supabaseAdmin, session })
          console.log('webhook: link paid', { code })

          // Email buyer download link (single source of truth)
          try {
            const buyerEmail = (session.customer_details?.email ?? session.customer_email ?? '').trim()
            if (!buyerEmail) {
              console.warn('webhook: no buyer email on session; not sending link email')
              break
            }

            const downloadUrl = `${origin}/dl/${encodeURIComponent(code)}`
            const amountCents = typeof session.amount_total === 'number' ? session.amount_total : null
            const currency = (session.currency ?? 'usd').toUpperCase()
            const amountLabel = amountCents != null ? `${(amountCents / 100).toFixed(2)} ${currency}` : null

            await sendEmail({
              to: buyerEmail,
              subject: 'Your FilePay link is ready',
              html: `
                <div style="font-family:system-ui;line-height:1.55">
                  <h2 style="margin:0 0 10px;">Payment confirmed ✅</h2>
                  ${amountLabel ? `<p style="margin:0 0 10px;"><b>Amount paid:</b> ${amountLabel}</p>` : ''}
                  <p style="margin:0 0 10px;">Your download link:</p>
                  <p style="margin:0 0 14px;"><a href="${downloadUrl}">${downloadUrl}</a></p>
                  <p style="margin:0;font-size:12px;color:#6b7280">Link code: <b>${code}</b></pSuggest style.
                </div>
              `,
            })

            console.log('webhook: link email sent to', buyerEmail)
          } catch (e) {
            console.error('webhook: link email failed (non-fatal)', e)
          }
        }

        break
      }

      /**
       * ✅ Keeps renew date fresh and can be used for “payment received” type emails
       * For now: DB sync only (to avoid duplicate emails with checkout.session.completed)
       */
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subId =
          typeof (invoice as any).subscription === 'string'
            ? ((invoice as any).subscription as string)
            : null

        if (subId) {
          const out = await syncProBySubscriptionId({ stripe, supabaseAdmin, stripeSubscriptionId: subId })
          console.log('webhook: invoice.paid sync', out)
        }
        break
      }

      /**
       * ✅ Cancellation emails:
       * - customer.subscription.updated: when cancel_at_period_end toggles (scheduled cancel / reactivated)
       * - customer.subscription.deleted: immediate cancel
       */
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const subId = String((sub as any)?.id ?? '').trim()
        if (!subId) break

        const out = await syncProBySubscriptionId({ stripe, supabaseAdmin, stripeSubscriptionId: subId })
        console.log('webhook: customer.subscription.updated sync', out)

        // Email only for meaningful changes: cancel scheduled on/off
        try {
          const custId =
            typeof (sub as any)?.customer === 'string' ? ((sub as any).customer as string) : null
          const to = await getCustomerEmail(stripe, custId)
          if (!to) {
            console.warn('webhook: subscription.updated email skipped (no customer email)')
            break
          }

          const cancelAtPeriodEnd =
            boolish((sub as any).cancel_at_period_end) ||
            (typeof (sub as any).cancel_at === 'number' && (sub as any).cancel_at > 0)

          const periodEndIso = unixToIso((sub as any).current_period_end)
          const periodEndLabel = formatDateShort(periodEndIso)
          const manageUrl = `${origin}/billing`

          // Only send when a schedule cancel is set OR removed.
          // Stripe provides previous_attributes but not always; safest: decide by current flag:
          if (cancelAtPeriodEnd) {
            await sendEmail({
              to,
              subject: 'Your Pro cancellation is scheduled',
              html: `
                <div style="font-family:system-ui;line-height:1.55">
                  <h2 style="margin:0 0 10px;">Cancellation scheduled ⚠️</h2>
                  <p style="margin:0 0 10px;">Your Pro plan will remain active until the end of your billing period.</p>
                  ${periodEndLabel ? `<p style="margin:0 0 10px;"><b>Valid until:</b> ${periodEndLabel}</p>` : ''}
                  <p style="margin:0 0 12px;">You can manage billing anytime: <a href="${manageUrl}">${manageUrl}</a></p>
                </div>
              `,
            })
            console.log('webhook: cancel scheduled email sent to', to)
          } else {
            // Reactivated (cancel schedule removed) — optional, but user asked “when I subscribe or cancel”
            // This is the “undo cancel” case (useful)
            await sendEmail({
              to,
              subject: 'Your Pro plan is active ✅',
              html: `
                <div style="font-family:system-ui;line-height:1.55">
                  <h2 style="margin:0 0 10px;">Pro is active ✅</h2>
                  <p style="margin:0 0 10px;">Your Pro plan remains active (cancellation not scheduled).</p>
                  ${periodEndLabel ? `<p style="margin:0 0 10px;"><b>Renews on:</b> ${periodEndLabel}</p>` : ''}
                  <p style="margin:0 0 12px;">Manage billing: <a href="${manageUrl}">${manageUrl}</a></p>
                </div>
              `,
            })
            console.log('webhook: cancel removed/reactivated email sent to', to)
          }
        } catch (e) {
          console.error('webhook: subscription.updated email failed (non-fatal)', e)
        }

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const subId = String((sub as any)?.id ?? '').trim()
        if (subId) {
          const out = await syncProBySubscriptionId({ stripe, supabaseAdmin, stripeSubscriptionId: subId })
          console.log('webhook: customer.subscription.deleted sync', out)
        }

        try {
          const custId =
            typeof (sub as any)?.customer === 'string' ? ((sub as any).customer as string) : null
          const to = await getCustomerEmail(stripe, custId)
          if (!to) {
            console.warn('webhook: subscription.deleted email skipped (no customer email)')
            break
          }

          const periodEndIso = unixToIso((sub as any).current_period_end)
          const periodEndLabel = formatDateShort(periodEndIso)
          const manageUrl = `${origin}/billing`

          await sendEmail({
            to,
            subject: 'Your Pro plan was canceled',
            html: `
              <div style="font-family:system-ui;line-height:1.55">
                <h2 style="margin:0 0 10px;">Pro canceled</h2>
                <p style="margin:0 0 10px;">Your Pro subscription has been canceled.</p>
                ${
                  periodEndLabel
                    ? `<p style="margin:0 0 10px;"><b>Access ends:</b> ${periodEndLabel}</p>`
                    : ''
                }
                <p style="margin:0 0 12px;">You can manage billing here: <a href="${manageUrl}">${manageUrl}</a></p>
              </div>
            `,
          })

          console.log('webhook: cancel deleted email sent to', to)
        } catch (e) {
          console.error('webhook: subscription.deleted email failed (non-fatal)', e)
        }

        break
      }

      // Optional (async payment methods)
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        console.log('webhook async checkout:', event.type)
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err: any) {
    console.error('stripe webhook error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}