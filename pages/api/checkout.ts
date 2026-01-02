import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-12-15.clover',
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { code } = req.body ?? {}
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Missing code' })

  const origin =
    (typeof req.headers.origin === 'string' && req.headers.origin) ||
    'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Descarga - ${code}` },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      metadata: { code },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe error:', err)
    return res.status(500).json({ error: err?.message ?? 'Stripe error' })
  }
}