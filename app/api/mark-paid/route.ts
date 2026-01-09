import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function mustEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

export async function POST(req: Request) {
  // ✅ Initialize inside handler (prevents Vercel build-time crashes)
  const supabaseAdmin = createClient(
    mustEnv('SUPABASE_URL'),
    mustEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  )

  const stripe = new Stripe(mustEnv('STRIPE_SECRET_KEY'), {
    apiVersion: '2025-12-15.clover',
  })

  try {
    const body = await req.json().catch(() => ({}))
    const sessionId = (body?.session_id as string | undefined)?.trim()

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    // ✅ 1) Pro bypass: session_id like "pro_<code>"
    if (sessionId.startsWith('pro_')) {
      const code = sessionId.replace(/^pro_/, '').trim()
      if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

      const { error } = await supabaseAdmin
        .from('file_links')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('code', code)

      if (error) throw new Error(error.message)

      return NextResponse.json({ ok: true, paid: true, code, mode: 'pro_bypass' }, { status: 200 })
    }

    // ✅ 2) Normal Stripe Checkout session flow
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Optional: Ensure session is actually paid
    // Stripe typically uses payment_status: "paid" for successful Checkout (payment mode)
    const paymentStatus = String((session as any)?.payment_status ?? '')
    if (paymentStatus && paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: `Checkout not paid yet (payment_status=${paymentStatus})` },
        { status: 400 }
      )
    }

    // You store code in metadata when creating the session in /api/checkout
    const code = (session.metadata?.code ?? '').trim()
    if (!code) {
      return NextResponse.json({ error: 'Missing code in session metadata' }, { status: 400 })
    }

    // Mark file link paid
    const { error: updErr } = await supabaseAdmin
      .from('file_links')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        stripe_session_id: sessionId,
      })
      .eq('code', code)

    if (updErr) throw new Error(updErr.message)

    // (Optional) store payment record if you have a payments table
    // If you don’t, you can remove this block safely.
    // Uncomment ONLY if your schema matches.
    /*
    await supabaseAdmin.from('payments').insert({
      code,
      stripe_session_id: sessionId,
      amount_total: session.amount_total ?? null,
      currency: session.currency ?? null,
      status: paymentStatus || null,
      created_at: new Date().toISOString(),
    }).catch(() => {})
    */

    return NextResponse.json(
      {
        ok: true,
        paid: true,
        code,
        mode: 'stripe_payment',
        payment_status: paymentStatus || null,
      },
      { status: 200 }
    )
  } catch (err: any) {
    console.error('mark-paid error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}