// app/success/page.tsx
import SuccessClient from './success-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SP = Record<string, string | string[] | undefined>

async function resolveSearchParams(sp: any): Promise<SP> {
  const v = await Promise.resolve(sp ?? {})
  return v && typeof v === 'object' ? (v as SP) : {}
}

function pickFirstString(v: unknown): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}

export default async function SuccessPage(props: { searchParams?: any }) {
  const sp = await resolveSearchParams(props.searchParams)

  const sessionId = pickFirstString(sp.session_id).trim()
  const debug = pickFirstString(sp.debug).trim() === '1'

  return <SuccessClient sessionId={sessionId} debug={debug} />
}