import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'FilePay',
    template: '%s · FilePay',
  },
  description: 'Upload a file and share a secure, paid download link.',
  applicationName: 'FilePay',
  metadataBase: new URL('https://filepay.vercel.app'),
  alternates: { canonical: '/' },

  verification: {
    google: 'Jx91reudk_AF16dKo6vGct-8Q6-J-OAFIWzAWdqLHVo',
  },

  icons: {
    icon: '/favicon.ico',
  },

  openGraph: {
    title: 'FilePay',
    description: 'Upload a file and share a secure, paid download link.',
    url: 'https://filepay.vercel.app',
    siteName: 'FilePay',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'FilePay',
    description: 'Upload a file and share a secure, paid download link.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
          strategy="afterInteractive"
        />
        <Script id="ga4" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX');
          `}
        </Script>
      </body>
    </html>
  )
}