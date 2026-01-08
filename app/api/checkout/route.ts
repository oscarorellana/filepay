import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Stripe init moved inside POST() for Vercel build safety

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

export async function POST(req: Request) {
  
  // Stripe is initialized inside the handler (prevents build-time crashes)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
  })

try {
    const body = await req.json()
    const code = (body?.code as string | undefined)?.trim()
    const daysRaw = body?.days

    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    const daysNum = Number(daysRaw ?? 14)
    const safeDays = [1, 3, 7, 14, 30].includes(daysNum) ? daysNum : 14
    const unitAmountCents = priceForDaysCents(safeDays)

    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
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
      metadata: {
        code,
        days: String(safeDays),
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
    })

    return NextResponse.json(
      { url: session.url, amount: unitAmountCents, days: safeDays },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('checkout error:', err)
    return NextResponse.json({ error: err?.message ?? 'Stripe error' }, { status: 500 })
  }
}