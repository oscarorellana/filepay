import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Stripe init moved inside POST() for Vercel build safety

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  
  // Stripe is initialized inside the handler (prevents build-time crashes)
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-12-15.clover',
  })

try {
    const body = await req.json().catch(() => ({}))
    const sessionId = (body?.session_id as string | undefined)?.trim()

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    // 1) pro-bypass for paid links
    if (sessionId.startsWith('pro_')) {
      const code = sessionId.replace(/^pro_/, '').trim()
      if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

      const { error } = await supabaseAdmin
        .from('file_links')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('code', code)

      if (error) throw new Error(error.message)

      return NextResponse.json({ paid: true, code }, { status: 200 })
    }

    // 2) Real Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // 2a) subscription => activate Pro
    if (session.mode === 'subscription') {
      const userId = (session.metadata?.user_id ?? '').trim()
      if (!userId) {
        return NextResponse.json({ error: 'Missing user_id in session metadata' }, { status: 400 })
      }

      // ✅ Idempotency guard (Pro): if already active, return OK
      const { data: existingSub, error: subErr } = await supabaseAdmin
        .from('subscriptions')
        .select('plan,status,stripe_subscription_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (subErr) throw new Error(subErr.message)

      if (existingSub?.plan === 'pro' && existingSub?.status === 'active') {
        return NextResponse.json({ pro: true, user_id: userId, status: 'active' }, { status: 200 })
      }

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : null

      const customerId =
        typeof session.customer === 'string' ? session.customer : null

      // Pull current_period_end (no TS fights)
      let currentPeriodEnd: string | null = null
      if (subscriptionId) {
        const sub: any = await stripe.subscriptions.retrieve(subscriptionId)
        const cpe = sub?.current_period_end
        if (typeof cpe === 'number') currentPeriodEnd = new Date(cpe * 1000).toISOString()
      }

      const { error } = await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan: 'pro',
            status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            current_period_end: currentPeriodEnd,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw new Error(error.message)

      return NextResponse.json({ pro: true, user_id: userId, status: 'active' }, { status: 200 })
    }

    // 2b) one-time payment => mark link paid + audit columns
    const code = (session.metadata?.code ?? '').trim()
    if (!code) {
      return NextResponse.json({ error: 'Missing code in session metadata' }, { status: 400 })
    }

    // ✅ Idempotency guard (paid links)
    const { data: existingLink, error: exErr } = await supabaseAdmin
      .from('file_links')
      .select('paid,stripe_session_id,code')
      .eq('code', code)
      .maybeSingle()

    if (exErr) throw new Error(exErr.message)

    if (existingLink?.paid && existingLink?.stripe_session_id === sessionId) {
      return NextResponse.json({ paid: true, code }, { status: 200 })
    }

    const { error } = await supabaseAdmin
      .from('file_links')
      .update({
        paid: true,
        stripe_session_id: sessionId,
        paid_at: new Date().toISOString(),
      })
      .eq('code', code)

    if (error) throw new Error(error.message)

    return NextResponse.json({ paid: true, code }, { status: 200 })
  } catch (err: any) {
    console.error('mark-paid error:', err)
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}