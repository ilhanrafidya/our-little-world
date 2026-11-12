'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Memory } from '@/types/memory';
import { formatDate } from '@/lib/format';
import { apiDeleteMemory, ApiError } from '@/lib/api-client';
import { useWorld } from '@/store/world-store';
import SpotifyEmbed from './SpotifyEmbed';
import { FlipIcon, HeartIcon, PencilIcon, PinIcon, StarIcon, TrashIcon, XIcon } from '@/components/ui/icons';

/** Kemiringan acak tapi stabil per kenangan (seperti foto ditempel di dinding). */
function tiltFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 50) - 25) / 10; // -2.5° … 2.5°
}

export default function PolaroidModal({ memory }: { memory: Memory | null }) {
  const select = useWorld((s) => s.select);
  const openEdit = useWorld((s) => s.openEdit);
  const removeMemory = useWorld((s) => s.removeMemory);
  const mode = useWorld((s) => s.mode);

  const [flipped, setFlipped] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset saat ganti kenangan
  useEffect(() => {
    setFlipped(false);
    setConfirmDelete(false);
    setError(null);
  }, [memory?.id]);

  const tilt = useMemo(() => (memory ? tiltFor(memory.id) : 0), [memory]);
  const open = !!memory && mode === 'map';

  async function onDelete() {
    if (!memory) return;
    setDeleting(true);
    setError(null);
    try {
      await apiDeleteMemory(memory.id);
      removeMemory(memory.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && memory && (
        <motion.div
          key="polaroid-backdrop"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => select(null)}
        >
          <motion.div
            key={memory.id}
            className="relative w-[min(86vw,360px)]"
            style={{ perspective: 1400 }}
            initial={{ y: 60, scale: 0.85, rotate: tilt - 6, opacity: 0 }}
            animate={{ y: 0, scale: 1, rotate: tilt, opacity: 1 }}
            exit={{ y: 40, scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="relative grid"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* ── DEPAN ── */}
              <div
                className="col-start-1 row-start-1 rounded-[6px] bg-cream-50 p-3 pb-5 text-night-950 shadow-2xl shadow-black/50"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
              >
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="block w-full overflow-hidden bg-night-800"
                  aria-label="Balik kartu untuk membaca cerita"
                >
                  {memory.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={memory.photo.url}
                      alt={memory.title}
                      width={memory.photo.width}
                      height={memory.photo.height}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-linear-to-br from-[#ffd3b0] via-[#ff9fb8] to-[#b9a6ff] text-white/90">
                      {memory.status === 'visited' ? <HeartIcon size={56} strokeWidth={1.25} /> : <StarIcon size={56} strokeWidth={1.25} />}
                    </div>
                  )}
                </button>
                <div className="px-1 pt-4">
                  <p className="font-hand text-[1.9rem] leading-none">{memory.title}</p>
                  <p className="mt-2 flex items-center justify-between gap-2 text-sm text-night-950/60">
                    <span className="flex min-w-0 items-center gap-1">
                      <PinIcon size={14} className="shrink-0" />
                      <span className="truncate">{memory.city}</span>
                    </span>
                    <span className="shrink-0">{memory.memoryDate ? formatDate(memory.memoryDate) : 'suatu hari nanti'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-night-950/35"
                >
                  <FlipIcon size={13} /> Balik kartu
                </button>
              </div>

              {/* ── BELAKANG ── */}
              <div
                className="col-start-1 row-start-1 flex flex-col rounded-[6px] bg-cream-100 p-5 text-night-950 shadow-2xl shadow-black/50"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  backgroundImage: 'repeating-linear-gradient(transparent 0 27px, rgba(23,23,58,0.08) 27px 28px)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      memory.status === 'visited' ? 'bg-[#ffe1e8] text-[#c2185b]' : 'bg-[#ebe6ff] text-[#5b4bc4]'
                    }`}
                  >
                    {memory.status === 'visited' ? <HeartIcon size={12} /> : <StarIcon size={12} />}
                    {memory.status === 'visited' ? 'Visited' : 'Wishlist'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFlipped(false)}
                    className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-night-950/40"
                  >
                    <FlipIcon size={13} /> Foto
                  </button>
                </div>

                <div className="mt-3 min-h-24 flex-1 overflow-y-auto">
                  {memory.story ? (
                    <p className="whitespace-pre-line font-hand text-[1.45rem] leading-[28px]">{memory.story}</p>
                  ) : (
                    <p className="font-hand text-xl text-night-950/40">Belum ada cerita. Tulis lewat tombol Edit.</p>
                  )}
                </div>

                {memory.spotifyUrl && (
                  <div className="mt-3">
                    <SpotifyEmbed url={memory.spotifyUrl} />
                  </div>
                )}

                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

                <div className="mt-4 flex gap-2">
                  {confirmDelete ? (
                    <>
                      <button
                        type="button"
                        onClick={onDelete}
                        disabled={deleting}
                        className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white active:scale-95 disabled:opacity-50"
                      >
                        {deleting ? 'Menghapus…' : 'Ya, hapus'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-xl bg-night-950/10 py-2.5 text-sm active:scale-95"
                      >
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(memory)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-night-950 py-2.5 text-sm font-medium text-cream-50 transition active:scale-95"
                      >
                        <PencilIcon size={15} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="grid place-items-center rounded-xl bg-night-950/[0.07] px-4 py-2.5 text-night-950/70 transition active:scale-95"
                        aria-label="Hapus kenangan"
                      >
                        <TrashIcon size={17} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            <button
              type="button"
              onClick={() => select(null)}
              aria-label="Tutup"
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-night-950 text-cream-50 shadow-lg active:scale-90"
            >
              <XIcon size={16} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
