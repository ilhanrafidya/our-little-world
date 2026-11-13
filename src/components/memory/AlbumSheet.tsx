'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import type { Memory, MemoryStatus, MemoryWho } from '@/types/memory';
import { PEOPLE, WHO_ORDER } from '@/lib/people';
import { formatDate } from '@/lib/format';
import { useWorld } from '@/store/world-store';
import { sound } from '@/lib/sound';
import { HeartIcon, PlusIcon, StarIcon, XIcon } from '@/components/ui/icons';

/** Kemiringan acak tapi stabil per kenangan. */
function tiltFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 40) - 20) / 10; // -2° … 2°
}

const ease = [0.22, 1, 0.36, 1] as const;

function MiniPolaroid({ memory, index, onOpen }: { memory: Memory; index: number; onOpen: () => void }) {
  const tilt = tiltFor(memory.id);
  const isNew = useWorld((s) => s.newIds.includes(memory.id));
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 18, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ delay: Math.min(index * 0.035, 0.5), type: 'spring', damping: 22, stiffness: 260 }}
      whileTap={{ scale: 0.96, rotate: 0 }}
      className="group w-full rounded-[3px] bg-cream-50 p-1.5 pb-2.5 text-left text-night-950 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-night-800">
        {isNew && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-night-950 shadow">
            New
          </span>
        )}
        {memory.status === 'visited' && memory.who !== 'together' && (
          <span
            className="olw-stamp absolute right-1.5 top-1.5 z-10 grid h-7 w-6 rotate-6 place-items-center text-[11px] font-bold text-white"
            style={{ background: PEOPLE[memory.who].color! }}
            aria-hidden
          >
            {PEOPLE[memory.who].initial}
          </span>
        )}
        {memory.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={memory.photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#ffd3b0] via-[#ff9fb8] to-[#b9a6ff] text-white/90">
            {memory.status === 'visited' ? <HeartIcon size={30} strokeWidth={1.4} /> : <StarIcon size={30} strokeWidth={1.4} />}
          </div>
        )}
      </div>
      <p className="mt-2 truncate px-0.5 font-hand text-[1.35rem] leading-none">{memory.title}</p>
      <p className="mt-1 flex items-center justify-between gap-1 px-0.5 text-[9.5px] font-medium uppercase tracking-[0.1em] text-night-950/45">
        <span className="truncate">{memory.city}</span>
        <span className="shrink-0">{memory.memoryDate ? formatDate(memory.memoryDate) : 'someday'}</span>
      </p>
    </motion.button>
  );
}

export default function AlbumSheet({ memories }: { memories: Memory[] }) {
  const open = useWorld((s) => s.albumOpen);
  const setOpen = useWorld((s) => s.setAlbumOpen);
  const enterMap = useWorld((s) => s.enterMap);
  const select = useWorld((s) => s.select);
  const openCreate = useWorld((s) => s.openCreate);
  const dragControls = useDragControls();
  const [tab, setTab] = useState<MemoryStatus>('visited');
  const [who, setWho] = useState<'all' | MemoryWho>('all');

  const counts = useMemo(
    () => ({
      visited: memories.filter((m) => m.status === 'visited').length,
      wishlist: memories.filter((m) => m.status === 'wishlist').length,
    }),
    [memories],
  );

  // Visited: terbaru dulu. Wishlist: yang ada tanggal rencana paling dekat dulu, lalu "someday".
  const items = useMemo(() => {
    const list = memories.filter((m) => m.status === tab && (tab === 'wishlist' || who === 'all' || m.who === who));
    return tab === 'visited'
      ? list.sort((a, b) => (b.memoryDate ?? '').localeCompare(a.memoryDate ?? '') || b.createdAt.localeCompare(a.createdAt))
      : list.sort((a, b) => (a.memoryDate ?? '9999').localeCompare(b.memoryDate ?? '9999'));
  }, [memories, tab, who]);

  const whoCounts = useMemo(() => {
    const visited = memories.filter((m) => m.status === 'visited');
    return {
      all: visited.length,
      together: visited.filter((m) => m.who === 'together').length,
      ilhan: visited.filter((m) => m.who === 'ilhan').length,
      nadya: visited.filter((m) => m.who === 'nadya').length,
    };
  }, [memories]);

  const cityCount = useMemo(() => new Set(items.map((m) => m.cityKey)).size, [items]);

  function close() {
    setOpen(false);
  }

  function openMemory(m: Memory) {
    setOpen(false);
    enterMap({ cityKey: m.cityKey, center: [m.lat, m.lng], zoom: 16 });
    setTimeout(() => select(m.id), 850);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) close();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="album"
          className="fixed inset-0 z-50 flex items-end justify-center bg-night-950/45 backdrop-blur-[6px] md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.3 }}
          onClick={close}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 320, mass: 0.9 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className="flex h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-[#14142e] text-cream-50 shadow-[0_-20px_60px_rgba(0,0,0,0.45)] md:h-[80dvh] md:rounded-[28px]"
            style={{
              backgroundImage:
                'radial-gradient(120% 60% at 50% 0%, rgba(255,122,156,0.14), transparent 60%), radial-gradient(80% 50% at 100% 100%, rgba(196,181,253,0.08), transparent 60%)',
            }}
          >
            {/* Header (geser turun untuk menutup) */}
            <div
              className="touch-none cursor-grab select-none px-6 pb-4 pt-3 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/20 md:hidden" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cream-50/45">Our album</p>
                  <h2 className="mt-1 font-display text-[28px] italic leading-tight">
                    {tab === 'visited' ? 'Places we’ve been' : 'Places we’ll go'}
                  </h2>
                  <p className="mt-1 text-xs text-cream-50/50">
                    {items.length} {items.length === 1 ? 'memory' : 'memories'} · {cityCount} {cityCount === 1 ? 'city' : 'cities'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-cream-50/70 transition active:scale-90"
                  aria-label="Close"
                >
                  <XIcon size={16} />
                </button>
              </div>

              {/* Tab Visited / Wishlist */}
              <div className="relative mt-5 grid grid-cols-2 rounded-2xl bg-white/[0.07] p-1" onPointerDown={(e) => e.stopPropagation()}>
                {(['visited', 'wishlist'] as const).map((t) => {
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className="relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium"
                    >
                      {active && (
                        <motion.span
                          layoutId="album-tab"
                          className="absolute inset-0 -z-10 rounded-xl bg-cream-50"
                          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                        />
                      )}
                      <span className={`flex items-center gap-2 transition-colors ${active ? 'text-night-950' : 'text-cream-50/55'}`}>
                        {t === 'visited' ? <HeartIcon size={15} /> : <StarIcon size={15} />}
                        {t === 'visited' ? 'Visited' : 'Wishlist'}
                        <span className={`text-xs tabular-nums ${active ? 'text-night-950/45' : 'text-cream-50/35'}`}>
                          {counts[t]}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter siapa (hanya Visited) */}
            <AnimatePresence initial={false}>
              {tab === 'visited' && (
                <motion.div
                  key="who-filter"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2 overflow-x-auto px-6 pb-3">
                    {(['all', ...WHO_ORDER] as const).map((w) => {
                      const active = who === w;
                      const color = w === 'all' ? null : (PEOPLE[w].color ?? 'var(--accent)');
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWho(w)}
                          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                            active ? 'border-transparent bg-cream-50 text-night-950' : 'border-white/12 text-cream-50/65'
                          }`}
                        >
                          {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                          {w === 'all' ? 'All' : PEOPLE[w].label}
                          <span className={`tabular-nums ${active ? 'text-night-950/40' : 'text-cream-50/35'}`}>
                            {whoCounts[w]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2">
              <AnimatePresence mode="wait">
                {items.length === 0 ? (
                  <motion.div
                    key={`empty-${tab}-${who}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-full flex-col items-center justify-center gap-4 pb-16 text-center"
                  >
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-white/[0.07] text-cream-50/60">
                      {tab === 'visited' ? <HeartIcon size={26} /> : <StarIcon size={26} />}
                    </div>
                    <p className="max-w-[16rem] text-sm text-cream-50/55">
                      {tab === 'visited' ? 'No memories yet. Save the first place you’ve been together.' : 'No wishes yet. Where do you want to go next?'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        openCreate();
                        if (tab === 'wishlist') useWorld.getState().updateDraft({ status: 'wishlist', memoryDate: '' });
                      }}
                      className="flex h-11 items-center gap-2 rounded-full bg-cream-50 px-5 text-sm font-medium text-night-950 active:scale-95"
                    >
                      <PlusIcon size={16} /> {tab === 'visited' ? 'Add a memory' : 'Add a wish'}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`grid-${tab}-${who}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease }}
                    className="grid grid-cols-2 gap-x-4 gap-y-5 pt-2 sm:grid-cols-3"
                  >
                    {items.map((m, i) => (
                      <MiniPolaroid
                        key={m.id}
                        memory={m}
                        index={i}
                        onOpen={() => {
                          sound.swish();
                          openMemory(m);
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
