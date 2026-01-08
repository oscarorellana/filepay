import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Stripe init moved inside POST() for Vercel build safety

// Service role para leer subscriptions (server-only)
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
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 })
    }

    // 1) Validar el usuario usando el access token
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const userId = userRes.user.id

    // 2) Leer stripe_customer_id desde tu tabla subscriptions
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, plan, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (subErr) throw new Error(subErr.message)

    const customerId = (subRow?.stripe_customer_id ?? '').trim()
    if (!customerId) {
      return NextResponse.json(
        {
          error:
            'No stripe_customer_id found for this user. Run /api/pro/sync (or complete a Pro checkout) first.',
        },
        { status: 400 }
      )
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const returnUrl = `${origin}/billing`

    // 3) Crear sesión de Customer Portal
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: portalSession.url }, { status: 200 })
  } catch (err: any) {
    console.error('portal error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Portal error' },
      { status: 500 }
    )
  }
}