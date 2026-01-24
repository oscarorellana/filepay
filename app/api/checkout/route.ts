// app/api/checkout/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

/**
 * Prices are in CENTS (USD)
 * 100 = $1.00, 800 = $8.00, etc.
 */
function priceForDaysCents(days: number) {
  const map: Record<number, number> = {
    1: 100,
    3: 200,
    7: 300,
    14: 500,
    30: 800,
  }
  return map[days] ?? 500
}

function getStripe() {
  const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY env var')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

/**
 * Prefer NEXT_PUBLIC_SITE_URL (set in Vercel) to avoid weird origin issues.
 * Fallback to request headers for local/dev.
 */
function getOrigin(req: Request) {
  const env = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '')
  if (env) return env

  // Fallback: infer from headers (works in many cases)
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (host) return `${proto}://${host}`

  return 'http://localhost:3000'
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const code = (body?.code as string | undefined)?.trim()
    const daysRaw = body?.days

    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    const daysNum = Number(daysRaw ?? 14)
    const safeDays = [1, 3, 7, 14, 30].includes(daysNum) ? daysNum : 14
    const unitAmountCents = priceForDaysCents(safeDays)

    const stripe = getStripe()
    const origin = getOrigin(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      // Helpful for searching in Stripe dashboard
      client_reference_id: code,

      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `FilePay link (${safeDays} day${safeDays === 1 ? '' : 's'})`,
              description: `Unlock download for code: ${code}`,
            },
            unit_amount: unitAmountCents,
          },
          quantity: 1,
        },
      ],

      // ✅ Keep metadata at the Session level (nice for dashboards / webhooks)
      metadata: {
        code,
        days: String(safeDays),
      },

      // ✅ ALSO put it on the PaymentIntent (super reliable for finalize fallback)
      payment_intent_data: {
        metadata: {
          code,
          days: String(safeDays),
        },
      },

      // ✅ IMPORTANT: this is what SuccessClient expects (cs_*)
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,

      // ✅ Avoid a /cancel page accidentally passing the wrong ID (pm_/pi_)
      cancel_url: `${origin}/?canceled=1`,
    })

    return NextResponse.json(
      { url: session.url, amount: unitAmountCents, days: safeDays },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('checkout error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Stripe error' },
      { status: 500 }
    )
  }
}