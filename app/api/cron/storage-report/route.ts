import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { signAdminAction } from '@/lib/admin-action'

export const dynamic = 'force-dynamic'



const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function requireCronSecret(req: Request) {
  const expected = (process.env.CRON_SECRET || '').trim()
  if (!expected) return false

  // Vercel Cron: Authorization: Bearer <secret>
  const auth = (req.headers.get('authorization') || '').trim()
  if (auth === `Bearer ${expected}`) return true

  // Manual/legacy: x-cron-secret: <secret>
  const legacy = (req.headers.get('x-cron-secret') || '').trim()
  if (legacy === expected) return true

  return false
}

function bytesToHuman(n: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export async function GET(req: Request) {
  try {
    if (!requireCronSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminEmail = (process.env.ADMIN_REPORT_EMAIL || '').trim()
    if (!adminEmail) {
      return NextResponse.json({ error: 'Missing ADMIN_REPORT_EMAIL' }, { status: 500 })
    }

    const resendKey = (process.env.RESEND_API_KEY || '').trim()
    const emailFrom = (process.env.EMAIL_FROM || '').trim()
    if (!resendKey || !emailFrom) {
      return NextResponse.json({ error: 'Missing RESEND_API_KEY or EMAIL_FROM' }, { status: 500 })
    }
    const resend = new Resend(resendKey)

    // 1) Total bytes “activos” (no borrados)
    const { data: activeRows, error: activeErr } = await supabaseAdmin
      .from('file_links')
      .select('file_bytes')
      .is('deleted_at', null)

    if (activeErr) throw new Error(activeErr.message)

    const totalBytes = (activeRows ?? []).reduce((acc, r: any) => {
  const v = typeof r.file_bytes === 'string' ? parseInt(r.file_bytes, 10) : Number(r.file_bytes)
  return acc + (Number.isFinite(v) ? v : 0)
}, 0)

    // 2) Expirados que aún no están marcados como borrados (o storage_deleted false)
    const { data: expiredRows, error: expErr } = await supabaseAdmin
      .from('file_links')
      .select('code,expires_at,file_bytes,file_path,created_at,paid')
      .lte('expires_at', new Date().toISOString())
      .is('deleted_at', null)
      .order('expires_at', { ascending: true })
      .limit(30)

    if (expErr) throw new Error(expErr.message)

    const expiredCount = expiredRows?.length ?? 0
    const expiredBytes = (expiredRows ?? []).reduce((acc, r: any) => {
    const v =
    typeof r.file_bytes === 'string'
      ? parseInt(r.file_bytes, 10)
      : Number(r.file_bytes)

  return acc + (Number.isFinite(v) ? v : 0)
}, 0)

    const lines = (expiredRows ?? []).map((r) => {
      const b = Number(r.file_bytes) || 0
      return `${r.code} · exp ${r.expires_at} · ${bytesToHuman(b)} · paid=${String(r.paid)}`
    })

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim()
    if (!siteUrl) {
    return NextResponse.json({ error: 'Missing NEXT_PUBLIC_SITE_URL' }, { status: 500 })
                  }
    const token = signAdminAction('purge_expired', 60 * 60) // 1 hora
    const adminLink = `${siteUrl}/admin/cleanup-expired?token=${encodeURIComponent(token)}`

const html = `
  <div style="font-family:system-ui;line-height:1.5">
    <h2 style="margin:0 0 10px;">FilePay daily storage report</h2>

    <p style="margin:0 0 10px;"><b>Estimated active storage:</b> ${bytesToHuman(totalBytes)}</p>
    <p style="margin:0 0 14px;"><b>Expired pending delete:</b> ${expiredCount} links (${bytesToHuman(expiredBytes)})</p>

    <div style="margin:14px 0 18px;">
      <a href="${adminLink}"
         style="display:inline-block;padding:10px 14px;border-radius:10px;
                background:#111827;color:white;text-decoration:none;font-weight:700">
        Review & delete all expired (secure)
      </a>
      <div style="font-size:12px;color:#6b7280;margin-top:6px">
        Link expires in 1 hour.
      </div>
    </div>

    ${expiredCount ? `
      <div style="padding:12px;border:1px solid #e5e7eb;border-radius:12px">
        <div style="font-weight:700;margin-bottom:8px">Top expired (max 30)</div>
        <pre style="margin:0;white-space:pre-wrap;font-size:12px">${lines.join('\n')}</pre>
      </div>
    ` : `<p style="margin:0;">No expired links pending delete ✅</p>`}

    <p style="margin:14px 0 0;font-size:12px;color:#6b7280">
      Note: totals are based on file_bytes stored at upload time.
    </p>
  </div>
`

    await resend.emails.send({
      from: emailFrom,
      to: adminEmail,
      subject: `FilePay report · Active ${bytesToHuman(totalBytes)} · Expired ${expiredCount}`,
      html,
    })

    return NextResponse.json({ ok: true, totalBytes, expiredCount })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}