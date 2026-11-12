import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Neon HTTP client (lazy). Dibuat saat pertama dipakai agar `next build`
 * tidak gagal walau DATABASE_URL belum diset di environment build.
 */
export function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL belum diset. Hubungkan Neon di Vercel → Storage, lalu `vercel env pull .env.local`.');
  }
  _sql = neon(url);
  return _sql;
}
