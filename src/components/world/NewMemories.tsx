'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorld } from '@/store/world-store';
import { getMe, registerSW } from '@/lib/notify-client';
import { getSeen, markSeen } from '@/lib/seen';
import { PEOPLE } from '@/lib/people';
import { sound } from '@/lib/sound';
import type { Memory } from '@/types/memory';

type Banner = { text: string; color: string };

/**
 * Saat app dibuka (atau kembali dari background): cek kenangan baru dari pasangan,
 * tampilkan ringkasan kecil, tandai titik kota & album dengan "New".
 */
export default function NewMemories() {
  const setNewIds = useWorld((s) => s.setNewIds);
  const clearNew = useWorld((s) => s.clearNew);
  const selectedId = useWorld((s) => s.selectedMemoryId);
  const setAlbumOpen = useWorld((s) => s.setAlbumOpen);
  const [banner, setBanner] = useState<Banner | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const check = useCallback(
    (memories: Memory[]) => {
      const latest = memories.reduce<string | null>((a, m) => (!a || m.createdAt > a ? m.createdAt : a), null);
      const seen = getSeen();
      if (!seen) {
        // pertama kali di HP ini: semua dianggap sudah dilihat
        markSeen(latest ?? new Date().toISOString());
        return;
      }
      const me = getMe();
      const fresh = memories.filter((m) => m.createdAt > seen && (!me || m.addedBy !== me));
      markSeen(latest);
      if (fresh.length === 0) return;

      const prev = useWorld.getState().newIds;
      setNewIds([...new Set([...prev, ...fresh.map((m) => m.id)])]);

      const by = [...new Set(fresh.map((m) => m.addedBy))];
      const n = fresh.length;
      const what = n === 1 ? (fresh[0]!.status === 'wishlist' ? 'a wishlist place' : 'a new memory') : `${n} new memories`;
      const who = by.length === 1 && by[0] ? by[0] : null;
      setBanner({
        text: who ? `${PEOPLE[who].label} added ${what}` : `${n === 1 ? 'A new memory' : `${n} new memories`} while you were away`,
        color: who ? PEOPLE[who].color! : 'var(--accent)',
      });
      sound.chime();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setBanner(null), 6000);
    },
    [setNewIds],
  );

  // Pertama kali dibuka
  const started = useRef(false);
  const memories = useWorld((s) => s.memories);
  useEffect(() => {
    if (started.current || !memories) return;
    started.current = true;
    void registerSW();
    check(memories);
  }, [memories, check]);

  // Kembali dari background → ambil data terbaru
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/memories', { cache: 'no-store' });
        if (!res.ok) return;
        const { memories: fresh } = (await res.json()) as { memories: Memory[] };
        useWorld.getState().setMemories(fresh);
        check(fresh);
      } catch {
        /* offline — abaikan */
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  // Kenangan dibuka → tanda New hilang
  useEffect(() => {
    if (selectedId) clearNew(selectedId);
  }, [selectedId, clearNew]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.6rem)] z-40 flex justify-center px-4">
    <AnimatePresence>
      {banner && (
        <motion.button
          key="new-banner"
          type="button"
          initial={{ opacity: 0, y: -16, scale: 0.92, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { type: 'spring', damping: 20, stiffness: 260, delay: 0.6 } }}
          exit={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.2 } }}
          onClick={() => {
            setBanner(null);
            setAlbumOpen(true);
          }}
          className="pointer-events-auto flex items-center gap-2.5 whitespace-nowrap rounded-full border border-white/15 bg-[var(--panel)] py-2 pl-3 pr-4 text-[13px] font-medium tracking-tight text-cream-50 shadow-lg shadow-black/25 backdrop-blur-xl"
        >
          <span className="relative grid h-2.5 w-2.5 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: banner.color }} />
            <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: banner.color }} />
          </span>
          {banner.text}
          <span className="text-cream-50/45">· View</span>
        </motion.button>
      )}
    </AnimatePresence>
    </div>
  );
}
