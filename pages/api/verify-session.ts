import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-12-15.clover',
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const session_id = req.query.session_id
  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'Missing session_id' })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id)
    const paid = session.payment_status === 'paid'
    const slug = session.metadata?.slug ?? null

    return res.status(200).json({ paid, slug })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err?.message ?? 'Stripe error' })
  }
}
