import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  // If no code, go home
  if (!code) {
    return NextResponse.redirect(new URL('/', url.origin))
  }

  // Create response first (we'll attach cookies to it if needed)
  const res = NextResponse.redirect(new URL('/', url.origin))

  // Supabase client (server) - we still exchange code
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  // If exchange fails, redirect to login with a hint
  if (error) {
    return NextResponse.redirect(new URL('/login?err=auth', url.origin))
  }

  return res
}