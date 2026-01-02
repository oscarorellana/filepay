import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'

function makeCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const { file_path, file_name, file_size, mime_type, days } = req.body ?? {}
  if (!file_path || typeof file_path !== 'string') {
    return res.status(400).json({ error: 'Missing file_path' })
  }

  const ttlDays = typeof days === 'number' && days > 0 ? days : 14
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()

  // intentamos varios códigos por si hay colisión
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = makeCode(8)

    const { error } = await supabaseAdmin
      .from('file_links')
      .insert({
        code,
        file_path,
        file_name: typeof file_name === 'string' ? file_name : null,
        file_size: typeof file_size === 'number' ? file_size : null,
        mime_type: typeof mime_type === 'string' ? mime_type : null,
        expires_at: expiresAt,
        paid: false,
      })

    if (!error) return res.status(200).json({ code, expires_at: expiresAt })

    // si fue colisión de PK, intenta de nuevo
    if (!String(error.message || '').toLowerCase().includes('duplicate')) {
      return res.status(500).json({ error: error.message })
    }
  }

  return res.status(500).json({ error: 'Could not generate a unique code' })
}