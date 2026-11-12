import type { Metadata, Viewport } from 'next';
import { Caveat, Fraunces, Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap', style: ['normal', 'italic'] });
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat', display: 'swap' });

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Our Little World';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Every place, together.',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // isi area notch; dipadukan dengan utilitas pt-safe / pb-safe
  themeColor: '#070716',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
