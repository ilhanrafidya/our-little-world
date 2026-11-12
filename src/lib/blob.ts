import { del } from '@vercel/blob';
import { BLOB_HOST_SUFFIX } from './validation';

/** Hapus foto lama dari Vercel Blob tanpa menggagalkan request utama. */
export async function deleteBlobSafe(url: string | null | undefined) {
  if (!url) return;
  try {
    if (!new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX)) return;
    await del(url);
  } catch (err) {
    console.error('[blob] gagal menghapus', url, err);
  }
}
