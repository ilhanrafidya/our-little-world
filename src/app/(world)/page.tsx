import { requirePageSession } from '@/lib/auth-guard';
import { listMemories } from '@/lib/memories-repo';
import WorldExperience from '@/components/world/WorldExperience';
import LockButton from '@/components/auth/LockButton';

export default async function WorldPage() {
  await requirePageSession('/');

  try {
    const memories = await listMemories();
    return <WorldExperience initialMemories={memories} />;
  } catch (err) {
    console.error('[world] gagal memuat', err);
    const missingTable = err instanceof Error && /memories_api|relation/.test(err.message);
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-display text-2xl italic">Dunia kita belum bisa dimuat 🥺</p>
        <p className="max-w-sm text-sm text-cream-50/70">
          {missingTable
            ? 'Tabel database belum ada. Jalankan db/schema.sql di Neon SQL Editor.'
            : 'Database belum terhubung. Coba muat ulang sebentar lagi.'}
        </p>
        <LockButton />
      </main>
    );
  }
}
