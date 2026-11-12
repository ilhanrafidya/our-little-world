'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { City } from '@/lib/geo';
import { formatDate } from '@/lib/format';
import type { Phase, ThemeOverride } from '@/lib/theme';
import { THEMES } from '@/lib/theme';
import { useWorld } from '@/store/world-store';
import LockButton from '@/components/auth/LockButton';
import { reverseGeocode } from '@/lib/geocode';
import {
  GlobeIcon,
  MoonIcon,
  PlayIcon,
  PlusIcon,
  StopIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
} from '@/components/ui/icons';

const PHASE_ICON = { dawn: SunriseIcon, day: SunIcon, dusk: SunsetIcon, night: MoonIcon } as const;

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
  const picking = useWorld((s) => s.editor.picking);
  const backToGlobe = useWorld((s) => s.backToGlobe);
  const t = THEMES[phase];
  const Icon = PHASE_ICON[phase];

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pt-safe">
      <AnimatePresence mode="wait" initial={false}>
        {picking ? (
          <span key="picking" />
        ) : mode === 'map' ? (
          <motion.button
            key="back"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onClick={backToGlobe}
            className={`pointer-events-auto flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium tracking-tight active:scale-95 ${glass}`}
          >
            <GlobeIcon size={17} /> Back to Globe
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
          aria-label="Change theme"
          className={`flex h-10 items-center gap-2 rounded-full pl-3 pr-3.5 text-[13px] font-medium tracking-tight active:scale-95 ${glass}`}
        >
          <Icon size={17} />
          <span>{t.label}</span>
          {override === 'auto' && (
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">
              Auto
            </span>
          )}
        </button>
        <LockButton className={glass} />
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cream-50/60">
              {state.index + 1} / {journey.length}
            </p>
            <p className="mt-1 font-display text-4xl italic text-cream-50 drop-shadow-lg">{current.name}</p>
            {current.firstDate && (
              <p className="mt-2 text-sm font-medium tracking-wide text-[var(--accent2)]">{formatDate(current.firstDate)}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-safe">
        <button
          onClick={state.playing ? stop : start}
          className="pointer-events-auto mb-2 flex h-12 items-center gap-2.5 rounded-full bg-cream-50 px-6 text-[15px] font-medium tracking-tight text-night-950 shadow-lg shadow-black/30 transition active:scale-95"
        >
          {state.playing ? (
            <>
              <StopIcon size={15} /> Stop
            </>
          ) : (
            <>
              <PlayIcon size={15} /> Play Journey
            </>
          )}
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
  // Di bawah (di atas tombol Play Journey) agar tidak menabrak judul
  return (
    <p
      className={`pointer-events-none absolute inset-x-0 z-10 px-24 text-center text-xs font-medium tracking-tight text-cream-50/55 ${
        empty ? 'bottom-[calc(max(env(safe-area-inset-bottom),1rem)+1.75rem)]' : 'bottom-[calc(max(env(safe-area-inset-bottom),1rem)+4.5rem)]'
      }`}
    >
      {empty ? 'No memories yet — tap + to add your first' : 'Tap a city or zoom in to explore'}
    </p>
  );
}

// ── Tombol "+" Add Spot ────────────────────────────────────────
export function AddSpotFab() {
  const openCreate = useWorld((s) => s.openCreate);
  const editorOpen = useWorld((s) => s.editor.open);
  const playing = useWorld((s) => s.journey.playing);
  const selected = useWorld((s) => s.selectedMemoryId);
  const hidden = editorOpen || playing || !!selected;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          key="fab"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 90 }}
          transition={{ type: 'spring', damping: 18, stiffness: 260 }}
          onClick={openCreate}
          aria-label="Tambah kenangan"
          className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-30 mb-2 grid h-14 w-14 place-items-center rounded-full bg-linear-to-br from-[var(--accent)] to-[var(--accent2)] text-night-950 shadow-xl shadow-black/35 transition active:scale-90"
        >
          <PlusIcon size={26} strokeWidth={2.2} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ── Mode pilih titik di peta (crosshair di tengah layar) ───────
export function PickOverlay() {
  const picking = useWorld((s) => s.editor.picking);
  const finishPicking = useWorld((s) => s.finishPicking);
  const cancelPicking = useWorld((s) => s.cancelPicking);
  const updateDraft = useWorld((s) => s.updateDraft);

  async function confirm() {
    const v = useWorld.getState().mapView;
    if (!v) return;
    finishPicking(v.lat, v.lng);
    const draft = useWorld.getState().draft;
    if (draft && !draft.city.trim()) {
      const { city, country } = await reverseGeocode(v.lat, v.lng);
      const latest = useWorld.getState().draft;
      if (latest && !latest.city.trim() && city) updateDraft({ city, country: latest.country || country || '' });
    }
  }

  return (
    <AnimatePresence>
      {picking && (
        <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-40">
          <p className={`absolute inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] mx-auto max-w-sm rounded-2xl px-4 py-3 text-center text-[13px] font-medium tracking-tight ${glass}`}>
            Geser peta sampai pin tepat di lokasi kenangan
          </p>
          {/* Pin di tengah layar — ujungnya menunjuk titik tengah peta */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <div className="olw-pin olw-pin--visited" style={{ transform: 'rotate(-45deg)' }}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20.5s-7.5-4.6-9.6-9.1C.9 8 2.9 4.5 6.4 4.5c2.1 0 3.6 1.2 4.4 2.5h2.4c.8-1.3 2.3-2.5 4.4-2.5 3.5 0 5.5 3.5 4 6.9-2.1 4.5-9.6 9.1-9.6 9.1z" />
              </svg>
            </div>
          </div>
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-night-950/60" />
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-center gap-2 px-4 pb-safe">
            <button onClick={cancelPicking} className={`mb-2 h-14 rounded-2xl px-5 text-[15px] font-medium tracking-tight active:scale-95 ${glass}`}>
              Batal
            </button>
            <button
              onClick={confirm}
              className="mb-2 h-14 max-w-xs flex-1 rounded-2xl bg-cream-50 px-5 text-[15px] font-medium tracking-tight text-night-950 shadow-lg active:scale-95"
            >
              Pakai titik ini
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
