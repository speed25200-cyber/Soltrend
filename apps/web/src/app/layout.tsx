import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import { WalletProviders } from '@/components/WalletProviders';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Soltrend — The on-chain casino the community builds',
  description:
    'Provably-fair Solana casino. Play instant Originals, build your own games no-code, and earn creator royalties. Connect with Phantom.',
  metadataBase: new URL('https://soltrend.io'),
  openGraph: { title: 'Soltrend', description: 'The Roblox of on-chain casino. Provably fair on Solana.' },
};

export const viewport: Viewport = {
  themeColor: '#05060f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Sora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WalletProviders>
          <AppShell>{children}</AppShell>
        </WalletProviders>
      </body>
    </html>
  );
}
