import type { Metadata } from 'next'
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
  icons: {
    icon: '/favicon.ico',
    // si luego agregas: public/icon.png / public/apple-icon.png
    // apple: '/apple-icon.png',
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
      <body>{children}</body>
    </html>
  )
}