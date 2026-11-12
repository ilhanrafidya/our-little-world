import { z } from 'zod';
import { normalizeSpotifyTrackUrl } from './spotify';

export const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com';
export const BLOB_PATH_PREFIX = 'memories/';

/** String kosong / spasi saja → null; selain itu di-trim. */
const emptyToNull = (v: unknown) => {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t === '' ? null : t;
};

const nullableText = (max: number, label: string) =>
  z.preprocess(emptyToNull, z.string().max(max, `${label} is too long (max ${max})`).nullable().optional());

const isBlobUrl = (u: string) => {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
};

export const photoSchema = z.object({
  url: z.url().refine(isBlobUrl, 'Photo must come from Vercel Blob'),
  pathname: z.string().startsWith(BLOB_PATH_PREFIX).max(300),
  width: z.int().positive().max(10_000),
  height: z.int().positive().max(10_000),
});

const spotifySchema = z
  .preprocess(emptyToNull, z.string().max(300).nullable().optional())
  .transform((v, ctx) => {
    if (v == null) return v;
    const normalized = normalizeSpotifyTrackUrl(v);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Use a Spotify song link (open.spotify.com/track/…). In Spotify: Share → Copy Song Link.',
      });
      return z.NEVER;
    }
    return normalized;
  });

const memoryFields = {
  title: z.string().trim().min(1, 'Please add a place name').max(120, 'Place name is too long (max 120)'),
  city: z.string().trim().min(1, 'Please add a city').max(80, 'City name is too long (max 80)'),
  country: nullableText(80, 'Country'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  status: z.enum(['visited', 'wishlist']),
  memoryDate: z.preprocess(emptyToNull, z.iso.date('Date must be YYYY-MM-DD').nullable().optional()),
  story: nullableText(5000, 'Story'),
  spotifyUrl: spotifySchema,
  photo: photoSchema.nullable().optional(),
};

export const createMemorySchema = z.object(memoryFields);
export const updateMemorySchema = z.object(memoryFields).partial();
export const idSchema = z.uuid();

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;

/** Ubah error Zod jadi daftar sederhana { field, message } untuk ditampilkan di form. */
export function formatIssues(error: z.ZodError) {
  return error.issues.map((i) => ({ field: i.path.join('.') || '_', message: i.message }));
}
