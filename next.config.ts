import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Foto kenangan disajikan dari Vercel Blob
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  // react-globe.gl & three dikirim sebagai ESM; transpile agar aman di bundler
  transpilePackages: ['react-globe.gl', 'globe.gl', 'three-globe'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Situs privat: jangan diindeks mesin pencari
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Izinkan geolocation hanya dari origin sendiri (dipakai di Tahap 4)
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self)' },
        ],
      },
    ];
  },
};

export default nextConfig;
