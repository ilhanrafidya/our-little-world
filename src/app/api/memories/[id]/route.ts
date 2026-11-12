import { after, type NextRequest } from 'next/server';
import { requireApiSession } from '@/lib/auth-guard';
import { deleteMemory, getMemory, updateMemory } from '@/lib/memories-repo';
import { formatIssues, idSchema, updateMemorySchema } from '@/lib/validation';
import { deleteBlobSafe } from '@/lib/blob';
import { jsonError, jsonOk, readJson } from '@/lib/http';

// Next.js 15+/16: params adalah Promise
type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const { id } = await ctx.params;
  const parsed = idSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

/** GET /api/memories/:id */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const id = await parseId(ctx);
  if (!id) return jsonError(400, 'ID tidak valid.');

  try {
    const memory = await getMemory(id);
    return memory ? jsonOk({ memory }) : jsonError(404, 'Kenangan tidak ditemukan.');
  } catch (err) {
    console.error('[memories:get]', err);
    return jsonError(500, 'Gagal memuat kenangan.');
  }
}

/** PATCH /api/memories/:id → edit sebagian field */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const id = await parseId(ctx);
  if (!id) return jsonError(400, 'ID tidak valid.');

  const body = await readJson(request);
  if (body === undefined) return jsonError(400, 'Body JSON tidak valid.');

  const parsed = updateMemorySchema.safeParse(body);
  if (!parsed.success) return jsonError(422, 'Data belum valid.', formatIssues(parsed.error));
  if (Object.keys(parsed.data).length === 0) return jsonError(400, 'Tidak ada perubahan.');

  try {
    const result = await updateMemory(id, parsed.data);
    if (!result) return jsonError(404, 'Kenangan tidak ditemukan.');

    // Foto diganti/dihapus → hapus file lama setelah response terkirim
    if (result.oldPhotoUrl) {
      const old = result.oldPhotoUrl;
      after(() => deleteBlobSafe(old));
    }
    return jsonOk({ memory: result.memory });
  } catch (err) {
    console.error('[memories:update]', err);
    return jsonError(500, 'Gagal menyimpan perubahan.');
  }
}

/** DELETE /api/memories/:id → hapus spot + fotonya */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const denied = await requireApiSession();
  if (denied) return denied;

  const id = await parseId(ctx);
  if (!id) return jsonError(400, 'ID tidak valid.');

  try {
    const result = await deleteMemory(id);
    if (!result) return jsonError(404, 'Kenangan tidak ditemukan.');

    if (result.photoUrl) {
      const url = result.photoUrl;
      after(() => deleteBlobSafe(url));
    }
    return jsonOk({ ok: true, id });
  } catch (err) {
    console.error('[memories:delete]', err);
    return jsonError(500, 'Gagal menghapus kenangan.');
  }
}
