import type { Metadata, Viewport } from 'next';
import { Caveat, Fraunces, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap', style: ['normal', 'italic'] });
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat', display: 'swap' });

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Our Little World';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Peta kenangan kecil kita berdua.',
  robots: { index: false, follow: false },
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
    <html lang="id" className={`${inter.variable} ${fraunces.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
