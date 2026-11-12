'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { City } from '@/lib/geo';
import { formatDate } from '@/lib/format';
import type { Phase, ThemeOverride } from '@/lib/theme';
import { THEMES } from '@/lib/theme';
import type { Memory } from '@/types/memory';
import { useWorld } from '@/store/world-store';
import LockButton from '@/components/auth/LockButton';

const glass =
  'border border-white/15 bg-[var(--panel)] text-cream-50 shadow-lg shadow-black/20 backdrop-blur-xl';

// ── Top bar ────────────────────────────────────────────────────
export function TopBar({
  phase,
  override,
  onCycleTheme,
}: {
  phase: Phase;
  override: ThemeOverride;
  onCycleTheme: () => void;
}) {
  const mode = useWorld((s) => s.mode);
  const backToGlobe = useWorld((s) => s.backToGlobe);
  const t = THEMES[phase];

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pt-safe">
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'map' ? (
          <motion.button
            key="back"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onClick={backToGlobe}
            className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium active:scale-95 ${glass}`}
          >
            <span aria-hidden>🌍</span> Back to Globe
          </motion.button>
        ) : (
          <motion.h1
            key="title"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="pt-1.5 font-display text-2xl italic text-cream-50 drop-shadow"
          >
            Our Little World
          </motion.h1>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          onClick={onCycleTheme}
          aria-label="Ganti tema"
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm active:scale-95 ${glass}`}
        >
          <span aria-hidden>{t.icon}</span>
          <span className="text-xs opacity-80">{override === 'auto' ? `Auto · ${t.label}` : t.label}</span>
        </button>
        <LockButton className={`!px-3 !text-xs ${glass}`} />
      </div>
    </header>
  );
}

// ── Play Journey ───────────────────────────────────────────────
export function JourneyControls({ journey }: { journey: City[] }) {
  const mode = useWorld((s) => s.mode);
  const state = useWorld((s) => s.journey);
  const start = useWorld((s) => s.startJourney);
  const stop = useWorld((s) => s.stopJourney);

  if (mode !== 'globe' || journey.length === 0) return null;
  const current = state.index >= 0 ? journey[state.index] : null;

  return (
    <>
      <AnimatePresence>
        {state.playing && current && (
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute inset-x-0 top-24 z-20 text-center"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-cream-50/70">
              {state.index + 1} / {journey.length}
            </p>
            <p className="mt-1 font-display text-4xl italic text-cream-50 drop-shadow-lg">{current.name}</p>
            {current.firstDate && (
              <p className="mt-1 font-hand text-2xl text-[var(--accent2)]">{formatDate(current.firstDate)}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-safe">
        <button
          onClick={state.playing ? stop : start}
          className="pointer-events-auto mb-2 flex items-center gap-2 rounded-full bg-linear-to-r from-[var(--accent)] to-[var(--accent2)] px-6 py-3.5 font-medium text-night-950 shadow-lg shadow-black/30 active:scale-95"
        >
          {state.playing ? '■ Stop' : '▶ Play Journey'}
        </button>
      </div>
    </>
  );
}

// ── Hint & empty state ─────────────────────────────────────────
export function GlobeHint({ empty }: { empty: boolean }) {
  const mode = useWorld((s) => s.mode);
  const playing = useWorld((s) => s.journey.playing);
  if (mode !== 'globe' || playing) return null;
  return (
    <p className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 px-6 text-center text-xs text-cream-50/60">
      {empty ? 'Belum ada kenangan di peta ini 💫 — zoom ke mana saja untuk membuka peta' : 'Ketuk kota atau zoom untuk masuk ke peta'}
    </p>
  );
}

// ── Kartu ringkas saat pin diklik (Polaroid lengkap menyusul) ──
export function MemoryPeek({ memory }: { memory: Memory | null }) {
  const select = useWorld((s) => s.select);
  const mode = useWorld((s) => s.mode);

  return (
    <AnimatePresence>
      {memory && mode === 'map' && (
        <motion.div
          key={memory.id}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-safe"
        >
          <div className={`pointer-events-auto mb-2 flex w-full max-w-md items-center gap-3 rounded-2xl p-3 ${glass}`}>
            {memory.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={memory.photo.url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
                {memory.status === 'visited' ? '💗' : '⭐'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{memory.title}</p>
              <p className="truncate text-sm text-cream-50/70">
                {memory.city}
                {memory.memoryDate ? ` · ${formatDate(memory.memoryDate)}` : ''}
              </p>
              {memory.story && <p className="mt-0.5 line-clamp-1 text-xs text-cream-50/60">{memory.story}</p>}
            </div>
            <button
              onClick={() => select(null)}
              aria-label="Tutup"
              className="self-start rounded-full p-1.5 text-cream-50/70 active:scale-90"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
