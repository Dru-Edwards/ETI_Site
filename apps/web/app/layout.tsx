import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from '@/components/analytics';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CloudFlair - Cloudflare-Native Web Platform',
  description: '90% agent-managed web platform built on Cloudflare with integrated AI automation',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://cloudflair.com'),
  openGraph: {
    title: 'CloudFlair - Cloudflare-Native Web Platform',
    description: '90% agent-managed web platform built on Cloudflare with integrated AI automation',
    url: 'https://cloudflair.com',
    siteName: 'CloudFlair',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CloudFlair - Cloudflare-Native Web Platform',
    description: '90% agent-managed web platform built on Cloudflare with integrated AI automation',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
