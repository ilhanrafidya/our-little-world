import { requirePageSession } from '@/lib/auth-guard';
import { listMemories } from '@/lib/memories-repo';
import LockButton from '@/components/auth/LockButton';
import type { Memory } from '@/types/memory';

/**
 * ⚠️ HALAMAN SEMENTARA (Tahap 2) — untuk memastikan auth + database jalan.
 * Di Tahap 3 isinya diganti <WorldExperience memories={memories} /> (Globe 3D ⇄ Peta 2D).
 */
export default async function WorldPage() {
  await requirePageSession('/');

  let memories: Memory[] = [];
  let dbError: string | null = null;
  try {
    memories = await listMemories();
  } catch (err) {
    console.error('[world] gagal memuat', err);
    dbError =
      err instanceof Error && /memories_api|relation/.test(err.message)
        ? 'Tabel belum ada. Jalankan db/schema.sql di Neon SQL Editor.'
        : 'Database belum terhubung. Cek DATABASE_URL.';
  }

  const cities = new Set(memories.map((m) => m.cityKey));
  const visited = memories.filter((m) => m.status === 'visited').length;

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pt-safe pb-safe">
      <header className="flex items-center justify-between py-4">
        <h1 className="font-display text-2xl italic">Our Little World</h1>
        <LockButton />
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-cream-50/60">Status backend (Tahap 2)</p>
        {dbError ? (
          <p className="mt-2 text-blush-300">⚠️ {dbError}</p>
        ) : (
          <p className="mt-2">
            ✅ Terhubung — <b>{memories.length}</b> spot, <b>{cities.size}</b> kota, <b>{visited}</b> visited,{' '}
            <b>{memories.length - visited}</b> wishlist.
          </p>
        )}
      </div>

      <ul className="mt-6 space-y-3">
        {memories.map((m) => (
          <li key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{m.title}</span>
              <span className="text-xs">{m.status === 'visited' ? '💗 visited' : '⭐ wishlist'}</span>
            </div>
            <p className="mt-1 text-sm text-cream-50/60">
              {m.city}
              {m.memoryDate ? ` · ${m.memoryDate}` : ''} · {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
