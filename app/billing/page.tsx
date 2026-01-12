// app/billing/page.tsx
import BillingClient from './billing-client'

export const dynamic = 'force-dynamic'

export default function BillingPage() {
  return <BillingClient />
}