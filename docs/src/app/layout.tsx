import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata, Viewport } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    template: '%s | Integrate',
    default: 'Integrate - The Universal Integration SDK',
  },
  description:
    'The easiest way to integrate your apps with third-party services like Google, Notion, Slack, and more using a type-safe SDK.',
  applicationName: 'Integrate',
  authors: [{ name: 'Integrate Team', url: 'https://integrate.dev' }],
  generator: 'Next.js',
  keywords: [
    'Integrate',
    'SDK',
    'API',
    'OAuth',
    'Authentication',
    'TypeScript',
    'React',
    'Next.js',
    'Integration Platform',
    'Universal API',
    'Unified API',
  ],
  referrer: 'origin-when-cross-origin',
  creator: 'Integrate',
  publisher: 'Integrate',
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
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Integrate - The Universal Integration SDK',
    description:
      'The easiest way to integrate your apps with third-party services like Google, Notion, Slack, and more using a type-safe SDK.',
    url: 'https://integrate.dev',
    siteName: 'Integrate',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: 'https://integrate.dev/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Integrate SDK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Integrate - The Universal Integration SDK',
    description:
      'The easiest way to integrate your apps with third-party services like Google, Notion, Slack, and more using a type-safe SDK.',
    creator: '@integrate_dev',
    site: '@integrate_dev',
    images: ['https://integrate.dev/og-image.png'],
  },
  alternates: {
    canonical: 'https://integrate.dev',
    languages: {
      'en-US': 'https://integrate.dev',
    },
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://integrate.dev')
  ),
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Integrate',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'The easiest way to integrate your apps with third-party services like Google, Notion, Slack, and more using a type-safe SDK.',
  url: 'https://integrate.dev',
  author: {
    '@type': 'Organization',
    name: 'Integrate',
    url: 'https://integrate.dev',
  },
};

export const viewport: Viewport = {
  themeColor: '#143163',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
