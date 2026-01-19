// app/terms/page.tsx
export const dynamic = 'force-dynamic'

export default function TermsPage() {
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui', maxWidth: 900, margin: '0 auto' }}>
      <h1>Terms of Service</h1>
      <p style={{ opacity: 0.7 }}>Last updated: January 2026</p>

      <p>
        FilePay is a temporary file-sharing platform operated from Canada and available
        internationally. By using FilePay, you agree to these Terms of Service.
      </p>

      <h2>1. Service Description</h2>
      <p>
        FilePay allows users to upload files and generate temporary access links.
        Files are automatically deleted after expiration.
      </p>

      <h2>2. User Responsibilities</h2>
      <p>You are solely responsible for any content you upload, store, or share using FilePay.</p>

      <p>You agree not to upload or distribute content that:</p>
      <ul>
        <li>Is illegal under Canadian law or applicable international laws</li>
        <li>Contains child sexual abuse material (CSAM)</li>
        <li>Includes malware, ransomware, or malicious software</li>
        <li>Infringes copyrights or intellectual property rights</li>
        <li>Is used for harassment, fraud, or abuse</li>
      </ul>

      <h2>3. Neutral Platform</h2>
      <p>
        FilePay is a neutral technology provider. We do not actively monitor,
        review, or endorse user-uploaded content.
      </p>

      <h2>4. Content Removal</h2>
      <p>
        FilePay reserves the right to remove content, disable links, or suspend access
        at any time, with or without notice, if we believe these Terms are violated
        or if required by law.
      </p>

      <h2>5. Retention and Deletion</h2>
      <p>
        Files are stored temporarily and automatically deleted after expiration.
        FilePay does not guarantee availability or recovery of files.
      </p>

      <h2>6. Legal Compliance</h2>
      <p>
        FilePay may cooperate with lawful requests from Canadian or international
        authorities as required by applicable law.
      </p>

      <h2>7. Disclaimer</h2>
      <p>
        The service is provided “as is” and “as available” without warranties
        of any kind.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, FilePay shall not be liable for
        any damages arising from the use of the service.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use of the service
        constitutes acceptance of the updated Terms.
      </p>
    </main>
  )
}