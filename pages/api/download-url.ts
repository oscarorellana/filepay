import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

  const slug = req.query.slug
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing slug' })
  }

  // ⚠️ cambia si tu bucket se llama distinto
  const bucket = 'uploads'

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(slug, 60 * 10) // 10 min

    if (error) throw error

    return res.status(200).json({ url: data.signedUrl })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err?.message ?? 'Supabase error' })
  }
}