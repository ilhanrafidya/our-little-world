import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { hasValidSession } from '@/lib/auth-guard';
import { jsonError, readJson } from '@/lib/http';

/**
 * Client upload Vercel Blob.
 * Alur: browser (HP) minta token ke sini → upload foto LANGSUNG ke Blob
 * (tidak lewat server function, jadi bebas limit body 4.5 MB)
 * → browser menerima { url, pathname } → dikirim bersama form ke POST /api/memories.
 *
 * Catatan: request ini juga dipanggil server Vercel (callback `blob.upload-completed`)
 * yang TIDAK membawa cookie. Karena itu cek sesi hanya di onBeforeGenerateToken;
 * keaslian callback diverifikasi otomatis oleh handleUpload (signature).
 */

const PATH_RE = /^memories\/[A-Za-z0-9_-]{1,80}\.(webp|jpe?g)$/i;
const MAX_BYTES = 3 * 1024 * 1024; // hasil kompresi 1200px biasanya 150–500 KB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await readJson(request)) as HandleUploadBody | undefined;
  if (!body) return jsonError(400, 'Invalid request body.');

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await hasValidSession())) throw new Error('UNAUTHORIZED');
        if (!PATH_RE.test(pathname)) throw new Error('Invalid file name.');

        return {
          allowedContentTypes: ['image/webp', 'image/jpeg'],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365, // foto tidak pernah ditimpa → aman di-cache lama
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Data disimpan lewat POST /api/memories, jadi di sini cukup log.
        // (Callback ini tidak terpanggil saat dev di localhost — itu normal.)
        console.info('[upload] selesai:', blob.pathname);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    if (message === 'UNAUTHORIZED') return jsonError(401, 'Session expired. Please unlock again.');
    return jsonError(400, message);
  }
}
