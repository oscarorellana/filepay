import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '../../../lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-12-15.clover',
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const sessionId = body?.session_id as string | undefined

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    /**
     * ✅ PRO bypass: session_id = "pro_<CODE>"
     * Marcar link como pagado en DB.
     */
    if (sessionId.startsWith('pro_')) {
      const code = sessionId.replace('pro_', '').trim()
      if (!code) {
        return NextResponse.json({ error: 'Missing code' }, { status: 400 })
      }

      const { error: upErr } = await supabaseAdmin
        .from('file_links')
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
        })
        .eq('code', code)

      if (upErr) {
        console.error('DB update error (pro mark-paid):', upErr)
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      return NextResponse.json({
        paid: true,
        code,
        paid_links_30d: 999,
      })
    }

    /**
     * 💳 Stripe normal
     */
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Invalid Stripe session' }, { status: 400 })
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ paid: false }, { status: 200 })
    }

    const code = (session.metadata?.code || session.metadata?.slug || '') as string
    if (!code) {
      return NextResponse.json({ error: 'Missing code in Stripe metadata' }, { status: 400 })
    }

    const { error: upErr } = await supabaseAdmin
      .from('file_links')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq('code', code)

    if (upErr) {
      console.error('DB update error (stripe mark-paid):', upErr)
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ paid: true, code, paid_links_30d: 0 }, { status: 200 })
  } catch (err: any) {
    console.error('mark-paid error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    )
  }
}