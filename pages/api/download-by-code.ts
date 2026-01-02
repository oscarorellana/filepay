import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const code = req.query.code
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Missing code' })

  const { data, error } = await supabaseAdmin
    .from('file_links')
    .select('file_path,paid,expires_at')
    .eq('code', code)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Not found' })

  const expired = new Date(data.expires_at).getTime() < Date.now()
  if (expired) return res.status(403).json({ error: 'Link expired' })
  if (!data.paid) return res.status(403).json({ error: 'Payment required' })

  const bucket = 'uploads'

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(data.file_path, 60 * 10)

  if (signErr) return res.status(500).json({ error: signErr.message })

  return res.status(200).json({ url: signed.signedUrl })
}