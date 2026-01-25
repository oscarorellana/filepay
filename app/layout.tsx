import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"

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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        {/* Google Ads tag */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17904652192"
          strategy="afterInteractive"
        />
        <Script id="google-ads" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17904652192');
          `}
        </Script>

        {/* Vercel Analytics */}
        <Analytics />
      </body>
    </html>
  )
}