import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const code = req.query.code
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Missing code' })

  const { data, error } = await supabaseAdmin
    .from('file_links')
    .select('code,file_name,file_size,mime_type,paid,expires_at')
    .eq('code', code)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Not found' })

  const expired = new Date(data.expires_at).getTime() < Date.now()

  return res.status(200).json({
    ...data,
    expired,
  })
}