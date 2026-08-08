import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { WalletProviders } from '@/components/WalletProviders';
import { AppShell } from '@/components/AppShell';
import { SITE_URL } from '@/lib/site';

/**
 * Type. Self-hosted at build time rather than pulled from Google at runtime —
 * a render-blocking third-party stylesheet meant the whole product fell back to
 * the system UI font whenever that request was slow or blocked, which is most of
 * why it never looked finished.
 *
 * Archivo carries the headlines and the cabinet marquee: a grotesque with real
 * weight in its bold, which is what a casino needs. Plus Jakarta Sans runs the
 * interface — warm, and legible at the small sizes this UI is full of — and IBM
 * Plex Mono takes every number, so figures line up column by column.
 */
const display = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display-src',
  display: 'swap',
});
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-src',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-src',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Soltrend — The on-chain casino the community builds',
    template: '%s · Soltrend',
  },
  description:
    'Provably-fair Solana casino. Play instant Originals for free or for real, build your own games no-code, and earn creator royalties. Connect with Phantom.',
  applicationName: 'Soltrend',
  keywords: ['Solana casino', 'provably fair', 'on-chain casino', 'crash', 'plinko', 'slots', 'game studio'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Soltrend',
    url: SITE_URL,
    title: 'Soltrend — The on-chain casino the community builds',
    description: 'Provably fair on Solana. Play free in demo, build your own game, earn a royalty on every bet it takes.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soltrend',
    description: 'Provably fair on Solana. Play free in demo, build your own game, earn a royalty on every bet it takes.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#05060f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <WalletProviders>
          <AppShell>{children}</AppShell>
        </WalletProviders>
      </body>
    </html>
  );
}
