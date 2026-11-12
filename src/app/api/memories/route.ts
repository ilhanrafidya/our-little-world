import { after, type NextRequest } from 'next/server';
import { requireApiSession } from '@/lib/auth-guard';
import { createMemory, listMemories } from '@/lib/memories-repo';
import { createMemorySchema, formatIssues } from '@/lib/validation';
import { deleteBlobSafe } from '@/lib/blob';
import { jsonError, jsonOk, readJson } from '@/lib/http';

/** GET /api/memories → semua kenangan (urut kronologis) */
export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;

  try {
    const memories = await listMemories();
    return jsonOk({ memories });
  } catch (err) {
    console.error('[memories:list]', err);
    return jsonError(500, 'Gagal memuat kenangan.');
  }
}

/** POST /api/memories → tambah spot baru */
export async function POST(request: NextRequest) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const body = await readJson(request);
  if (body === undefined) return jsonError(400, 'Body JSON tidak valid.');

  const parsed = createMemorySchema.safeParse(body);
  if (!parsed.success) return jsonError(422, 'Data belum lengkap/valid.', formatIssues(parsed.error));

  try {
    const memory = await createMemory(parsed.data);
    return jsonOk({ memory }, 201);
  } catch (err) {
    console.error('[memories:create]', err);
    // Foto sudah terlanjur di-upload tapi data gagal disimpan → bersihkan agar tidak jadi file yatim
    const orphan = parsed.data.photo?.url;
    if (orphan) after(() => deleteBlobSafe(orphan));
    return jsonError(500, 'Gagal menyimpan kenangan.');
  }
}
