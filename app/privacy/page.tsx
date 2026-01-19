// app/privacy/page.tsx
export const dynamic = 'force-dynamic'

export default function PrivacyPage() {
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui', maxWidth: 900, margin: '0 auto' }}>
      <h1>Privacy Policy</h1>
      <p style={{ opacity: 0.7 }}>Last updated: January 2026</p>

      <p>
        FilePay is committed to protecting your privacy and complying with
        Canadian privacy laws (PIPEDA) and applicable international standards.
      </p>

      <h2>1. Information We Collect</h2>
      <p>We collect minimal technical information necessary to operate the service:</p>
      <ul>
        <li>IP address or hashed IP</li>
        <li>File metadata (size, timestamps)</li>
        <li>System and security logs</li>
        <li>Optional user identifiers (if accounts are used)</li>
      </ul>

      <h2>2. File Content</h2>
      <p>
        FilePay does not inspect, analyze, or monitor the contents of uploaded files.
      </p>

      <h2>3. Use of Information</h2>
      <p>
        Information is used solely to:
      </p>
      <ul>
        <li>Operate and maintain the service</li>
        <li>Prevent abuse and ensure security</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        Data is retained only as long as necessary for operational,
        security, or legal purposes.
      </p>

      <h2>5. Legal Disclosure</h2>
      <p>
        We may disclose information if required by law, court order,
        or valid legal process.
      </p>

      <h2>6. International Use</h2>
      <p>
        FilePay operates from Canada. By using the service, you acknowledge
        that data may be processed in Canada.
      </p>

      <h2>7. Security</h2>
      <p>
        We take reasonable technical and organizational measures
        to protect stored information.
      </p>

      <h2>8. Changes</h2>
      <p>
        This Privacy Policy may be updated periodically.
        Continued use of the service indicates acceptance.
      </p>
    </main>
  )
}