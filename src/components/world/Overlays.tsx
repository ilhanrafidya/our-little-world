'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { haversineKm, type City } from '@/lib/geo';
import { formatDate } from '@/lib/format';
import type { Phase, ThemeOverride } from '@/lib/theme';
import { THEMES } from '@/lib/theme';
import { useWorld, type SpotDraft } from '@/store/world-store';
import type { MemoryWho } from '@/types/memory';
import { PEOPLE, WHO_ORDER } from '@/lib/people';
import LockButton from '@/components/auth/LockButton';
import { reverseGeocode, searchPlaces, type PlaceResult } from '@/lib/geocode';
import {
  AlbumIcon,
  PinIcon,
  SearchIcon,
  XIcon,
  GearIcon,
  GlobeIcon,
  MuteIcon,
  RotateIcon,
  VolumeIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  RouteIcon,
  PlusIcon,
  SkipIcon,
  StopIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
} from '@/components/ui/icons';

const PHASE_ICON = { dawn: SunriseIcon, day: SunIcon, dusk: SunsetIcon, night: MoonIcon } as const;

const glass =
  'border border-white/15 bg-[var(--panel)] text-cream-50 shadow-lg shadow-black/20 backdrop-blur-xl';

// ── Top bar + menu settings ───────────────────────────────────
const springOut = { type: 'spring', damping: 22, stiffness: 320 } as const;

export function TopBar({
  phase,
  override,
  onCycleTheme,
  showRoutes,
  onToggleRoutes,
  autoRotate,
  onToggleRotate,
  muted,
  onToggleMute,
}: {
  phase: Phase;
  override: ThemeOverride;
  onCycleTheme: () => void;
  showRoutes: boolean;
  onToggleRoutes: () => void;
  autoRotate: boolean;
  onToggleRotate: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const mode = useWorld((s) => s.mode);
  const picking = useWorld((s) => s.editor.picking);
  const backToGlobe = useWorld((s) => s.backToGlobe);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (picking) setOpen(false);
  }, [picking]);
  const t = THEMES[phase];
  const Icon = PHASE_ICON[phase];

  const on = 'border border-transparent bg-cream-50 text-night-950 shadow-lg';
  const circle = 'grid h-10 w-10 place-items-center rounded-full transition-colors active:scale-90';

  // Tombol keluar dari posisi ⚙️: baris ke kiri & kolom ke bawah, bergiliran
  const leftItem = (i: number) => ({
    initial: { opacity: 0, x: 44 * (i + 1), scale: 0.6 },
    animate: { opacity: 1, x: 0, scale: 1, transition: { ...springOut, delay: 0.03 * i } },
    exit: { opacity: 0, x: 44 * (i + 1), scale: 0.6, transition: { duration: 0.16 } },
  });
  const downItem = (i: number) => ({
    initial: { opacity: 0, y: -44 * (i + 1), scale: 0.6 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { ...springOut, delay: 0.03 * i } },
    exit: { opacity: 0, y: -44 * (i + 1), scale: 0.6, transition: { duration: 0.16 } },
  });

  return (
    <>
      {/* tap di luar menu → tutup */}
      {open && <div className="fixed inset-0 z-[29]" onClick={() => setOpen(false)} aria-hidden />}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pt-safe">
        <AnimatePresence mode="wait" initial={false}>
          {picking ? (
            <span key="picking" />
          ) : mode === 'map' ? (
            <motion.button
              key="back"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: open ? 0 : 1, x: 0 }}
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
              animate={{ opacity: open ? 0 : 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="pt-1.5 font-display text-2xl italic text-cream-50 drop-shadow"
            >
              Our Little World
            </motion.h1>
          )}
        </AnimatePresence>

        {/* Saat memilih titik di peta, menu settings disembunyikan agar layar fokus */}
        <motion.div
          className="pointer-events-auto relative"
          initial={false}
          animate={picking ? { opacity: 0, scale: 0.6, y: -8 } : { opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          style={{ pointerEvents: picking ? 'none' : 'auto' }}
        >
          {/* Baris ke kiri: rute + tema */}
          <AnimatePresence>
            {open && (
              <div className="absolute right-12 top-0 flex items-center gap-2">
                <motion.button
                  key="routes"
                  {...leftItem(1)}
                  onClick={onToggleRoutes}
                  aria-label={showRoutes ? 'Hide routes' : 'Show routes'}
                  aria-pressed={showRoutes}
                  className={`${circle} ${showRoutes ? on : glass}`}
                >
                  <RouteIcon size={18} />
                </motion.button>
                <motion.button
                  key="theme"
                  {...leftItem(0)}
                  onClick={onCycleTheme}
                  aria-label="Change theme"
                  className={`flex h-10 items-center gap-2 whitespace-nowrap rounded-full pl-3 pr-3.5 text-[13px] font-medium tracking-tight active:scale-95 ${glass}`}
                >
                  <Icon size={17} />
                  <span>{t.label}</span>
                  {override === 'auto' && (
                    <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-80">
                      Auto
                    </span>
                  )}
                </motion.button>
              </div>
            )}
          </AnimatePresence>

          {/* ⚙️ */}
          <motion.button
            onClick={() => setOpen((v) => !v)}
            aria-label="Settings"
            aria-expanded={open}
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            className={`relative z-10 ${circle} ${open ? on : glass}`}
          >
            <GearIcon size={19} />
          </motion.button>

          {/* Kolom ke bawah: mute, bumi berputar, lock */}
          <AnimatePresence>
            {open && (
              <div className="absolute right-0 top-12 flex flex-col items-center gap-2">
                <motion.button
                  key="mute"
                  {...downItem(0)}
                  onClick={onToggleMute}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  aria-pressed={muted}
                  className={`${circle} ${glass}`}
                >
                  {muted ? <MuteIcon size={18} /> : <VolumeIcon size={18} />}
                </motion.button>
                <motion.button
                  key="rotate"
                  {...downItem(1)}
                  onClick={onToggleRotate}
                  aria-label={autoRotate ? 'Stop globe rotation' : 'Rotate globe'}
                  aria-pressed={autoRotate}
                  className={`${circle} ${autoRotate ? on : glass}`}
                >
                  <RotateIcon size={19} />
                </motion.button>
                <motion.div key="lock" {...downItem(2)}>
                  <LockButton className={glass} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </header>
    </>
  );
}

// ── Play Journey ───────────────────────────────────────────────
const nf = new Intl.NumberFormat('en-US');

function PlaneGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 15.5v-1.6l-7.5-4.6V4a1.5 1.5 0 0 0-3 0v5.3L3 13.9v1.6l7.5-2.3v5.1l-2 1.5V21l3.5-1 3.5 1v-1.2l-2-1.5v-5.1z" />
    </svg>
  );
}
function CarGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5.5 10.5l1.4-4a2 2 0 0 1 1.9-1.3h6.4a2 2 0 0 1 1.9 1.3l1.4 4A2 2 0 0 1 20 12.4V17a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4.6a2 2 0 0 1 1.5-1.9zm2.1-.3h8.8l-1-2.9a.5.5 0 0 0-.5-.3H9.1a.5.5 0 0 0-.5.3zM7 14.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm10 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" />
    </svg>
  );
}

const JOURNEY_TITLE: Record<MemoryWho, { intro: string; outro: string }> = {
  together: { intro: 'Our Journey', outro: 'So far, together' },
  ilhan: { intro: 'Ilhan’s Journey', outro: 'Where Ilhan has been' },
  nadya: { intro: 'Nadya’s Journey', outro: 'Where Nadya has been' },
};

export function JourneyControls({ journeys }: { journeys: Record<MemoryWho, City[]> }) {
  const mode = useWorld((s) => s.mode);
  const j = useWorld((s) => s.journey);
  const start = useWorld((s) => s.startJourney);
  const stop = useWorld((s) => s.stopJourney);
  const togglePause = useWorld((s) => s.togglePauseJourney);
  const skip = useWorld((s) => s.skipJourney);

  const choosing = useWorld((s) => s.journeyChoosing);
  const setChoosing = useWorld((s) => s.setJourneyChoosing);
  const journey = journeys[j.who];
  const available = WHO_ORDER.filter((w) => journeys[w].length > 0);

  // Tutup pilihan kalau mode berubah / journey mulai
  useEffect(() => {
    if (j.playing || mode !== 'globe') setChoosing(false);
  }, [j.playing, mode]);

  if (mode !== 'globe' || available.length === 0) return null;

  const onPlay = () => {
    // hanya ada satu jenis journey → langsung mulai
    if (available.length === 1) start(available[0]);
    else setChoosing(true);
  };

  const city = j.index >= 0 ? journey[j.index] : undefined;
  const from = j.index > 0 ? journey[j.index - 1] : undefined;
  const legKm = city && from ? haversineKm(from, city) : 0;

  return (
    <>
      <AnimatePresence mode="wait">
        {/* Intro */}
        {j.playing && j.phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 top-[30%] z-20 text-center"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-cream-50/60">
              {journey.length} {journey.length === 1 ? 'city' : 'cities'}
            </p>
            <p className="mt-3 font-display text-5xl italic text-cream-50 drop-shadow-lg">{JOURNEY_TITLE[j.who].intro}</p>
          </motion.div>
        )}

        {/* Dalam perjalanan */}
        {j.playing && j.phase === 'travel' && city && from && (
          <motion.div
            key={`travel-${j.index}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 flex justify-center px-4"
          >
            <div className={`flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px] font-medium tracking-tight ${glass}`}>
              <span className="text-[var(--accent2)]">{j.vehicle === 'car' ? <CarGlyph /> : <PlaneGlyph />}</span>
              <span className="max-w-[9rem] truncate">{from.name}</span>
              <span className="opacity-50">→</span>
              <span className="max-w-[9rem] truncate">{city.name}</span>
              <span className="tabular-nums opacity-55">· {nf.format(Math.round(legKm))} km</span>
            </div>
          </motion.div>
        )}

        {/* Tiba: kartu mini Polaroid */}
        {j.playing && j.phase === 'arrive' && city && (
          <motion.div
            key={`arrive-${j.index}`}
            initial={{ opacity: 0, y: 30, rotate: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, rotate: j.index % 2 ? 2 : -2, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),1rem)+7rem)] z-20 flex justify-center"
          >
            <div className="w-44 rounded-[4px] bg-cream-50 p-2 pb-3 text-night-950 shadow-2xl shadow-black/50">
              {city.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={city.coverUrl} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="aspect-square w-full bg-linear-to-br from-[#ffd3b0] via-[#ff9fb8] to-[#b9a6ff]" />
              )}
              <p className="mt-2 truncate px-0.5 font-hand text-2xl leading-none">{city.name}</p>
              <p className="mt-1 flex justify-between px-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-night-950/50">
                <span>{city.firstDate ? formatDate(city.firstDate) : ''}</span>
                <span>
                  {city.count} {city.count === 1 ? 'memory' : 'memories'}
                </span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Ringkasan akhir */}
        {j.playing && j.phase === 'outro' && j.summary && (
          <motion.div
            key="outro"
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.9, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 top-[26%] z-20 px-6 text-center"
          >
            <p className="font-display text-4xl italic text-cream-50 drop-shadow-lg">{JOURNEY_TITLE[j.who].outro}</p>
            <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-2">
              {[
                [j.summary.cities, j.summary.cities === 1 ? 'city' : 'cities'],
                [nf.format(j.summary.km), 'km'],
                [j.summary.memories, j.summary.memories === 1 ? 'memory' : 'memories'],
              ].map(([v, l]) => (
                <div key={String(l)} className={`rounded-2xl px-2 py-3 ${glass}`}>
                  <p className="text-xl font-semibold tabular-nums tracking-tight">{v}</p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] opacity-60">{l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {choosing && <div className="fixed inset-0 z-[19]" onClick={() => setChoosing(false)} aria-hidden />}

      {/* Kontrol */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-safe">
        {j.playing && (
          <div className="flex gap-1.5" aria-hidden>
            {journey.map((c, i) => (
              <span
                key={c.key}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i < j.index || (i === j.index && j.phase !== 'travel')
                    ? 'w-4 bg-cream-50'
                    : i === j.index
                      ? 'w-4 bg-cream-50/50'
                      : 'w-1.5 bg-cream-50/25'
                }`}
              />
            ))}
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {j.playing ? (
            <motion.div
              key="ctrl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="pointer-events-auto mb-2 flex items-center gap-2"
            >
              <button onClick={stop} aria-label="Stop" className={`grid h-12 w-12 place-items-center rounded-full active:scale-90 ${glass}`}>
                <StopIcon size={15} />
              </button>
              <button
                onClick={togglePause}
                aria-label={j.paused ? 'Resume' : 'Pause'}
                className="grid h-14 w-14 place-items-center rounded-full bg-cream-50 text-night-950 shadow-lg active:scale-90"
              >
                {j.paused ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
              </button>
              <button onClick={skip} aria-label="Skip" className={`grid h-12 w-12 place-items-center rounded-full active:scale-90 ${glass}`}>
                <SkipIcon size={17} />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 10, width: 172 }}
              animate={{ opacity: 1, y: 0, width: choosing ? 272 : 172 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ width: { type: 'spring', damping: 24, stiffness: 300 } }}
              className="pointer-events-auto relative z-[31] mb-2 h-12 overflow-hidden rounded-full bg-cream-50 text-night-950 shadow-lg shadow-black/30"
            >
              <AnimatePresence initial={false}>
                {choosing ? (
                  <motion.div
                    key="choices"
                    className="absolute inset-0 flex items-center justify-center whitespace-nowrap"
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)', transition: { delay: 0.03, duration: 0.24 } }}
                    exit={{ opacity: 0, filter: 'blur(4px)', transition: { duration: 0.14 } }}
                  >
                    {WHO_ORDER.map((w, i) => {
                      const enabled = journeys[w].length > 0;
                      return (
                        <motion.button
                          key={w}
                          type="button"
                          disabled={!enabled}
                          whileTap={enabled ? { scale: 0.95 } : undefined}
                          onClick={() => {
                            setChoosing(false);
                            start(w);
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: enabled ? 1 : 0.35, transition: { delay: 0.05 + i * 0.04, duration: 0.2 } }}
                          className="flex h-10 items-center gap-2 rounded-full px-3.5 text-[15px] font-medium tracking-tight transition-colors active:bg-night-950/5"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: PEOPLE[w].color ?? 'var(--accent)' }}
                          />
                          {PEOPLE[w].label}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.button
                    key="label"
                    type="button"
                    onClick={onPlay}
                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)', transition: { delay: 0.03, duration: 0.24 } }}
                    exit={{ opacity: 0, filter: 'blur(4px)', transition: { duration: 0.14 } }}
                    className="absolute inset-0 flex items-center justify-center gap-2.5 whitespace-nowrap text-[15px] font-medium tracking-tight active:scale-95"
                  >
                    <PlayIcon size={15} /> Play Journey
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
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
      className={`pointer-events-none fixed inset-x-0 z-10 px-24 text-center text-xs font-medium tracking-tight text-cream-50/55 ${
        empty ? 'bottom-[calc(max(env(safe-area-inset-bottom),1rem)+1.75rem)]' : 'bottom-[calc(max(env(safe-area-inset-bottom),1rem)+3.9rem)]'
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
  const albumOpen = useWorld((s) => s.albumOpen);
  const choosing = useWorld((s) => s.journeyChoosing);
  const hidden = editorOpen || playing || !!selected || albumOpen || choosing;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          key="fab"
          initial={{ opacity: 0, scale: 0.55, rotate: -60 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', damping: 15, stiffness: 230, delay: 0.24 } }}
          exit={{ opacity: 0, scale: 0.55, rotate: 60, transition: { duration: 0.16, ease: 'easeIn' } }}
          whileTap={{ scale: 0.9 }}
          style={{ willChange: 'transform, opacity' }}
          onClick={openCreate}
          aria-label="Add memory"
          className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-30 mb-2 grid h-14 w-14 place-items-center rounded-full bg-linear-to-br from-[var(--accent)] to-[var(--accent2)] text-night-950 shadow-xl shadow-black/35 transition-colors"
        >
          <PlusIcon size={26} strokeWidth={2.2} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ── Tombol album (kiri bawah, sejajar tombol +) ────────────────
export function AlbumButton() {
  const setOpen = useWorld((s) => s.setAlbumOpen);
  const editorOpen = useWorld((s) => s.editor.open);
  const playing = useWorld((s) => s.journey.playing);
  const selected = useWorld((s) => s.selectedMemoryId);
  const albumOpen = useWorld((s) => s.albumOpen);
  const choosing = useWorld((s) => s.journeyChoosing);
  const hidden = editorOpen || playing || !!selected || albumOpen || choosing;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          key="album-btn"
          initial={{ opacity: 0, scale: 0.55, rotate: 60 }}
          animate={{ opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', damping: 15, stiffness: 230, delay: 0.24 } }}
          exit={{ opacity: 0, scale: 0.55, rotate: -60, transition: { duration: 0.16, ease: 'easeIn' } }}
          whileTap={{ scale: 0.9 }}
          style={{ willChange: 'transform, opacity' }}
          onClick={() => setOpen(true)}
          aria-label="Open album"
          className={`fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-4 z-30 mb-2 grid h-14 w-14 place-items-center rounded-full transition-colors ${glass}`}
        >
          <AlbumIcon size={23} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ── Cari tempat (di mode pilih titik) ─────────────────────────
function PlaceSearch() {
  const enterMap = useWorld((s) => s.enterMap);
  const updateDraft = useWorld((s) => s.updateDraft);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Tap/geser di luar kotak pencarian (mis. peta) → tutup daftar hasil & keyboard
  useEffect(() => {
    if (!showList) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setShowList(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [showList]);

  // Cari otomatis setelah berhenti mengetik (hemat request)
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) {
      setResults([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const v = useWorld.getState().mapView;
        const r = await searchPlaces(query, v ?? undefined, ctrl.signal);
        // buang hasil dobel (nama + keterangan sama)
        const seen = new Set<string>();
        const unique = r.filter((x) => {
          const k = `${x.name}|${x.detail}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setResults(unique);
        setError(unique.length === 0 ? 'No places found. Try a nearby street or landmark.' : null);
      } catch (err) {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Search failed.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  function choose(r: PlaceResult) {
    inputRef.current?.blur();
    setShowList(false);
    setResults([]);
    setQ(r.name);
    enterMap({ center: [r.lat, r.lng], zoom: 17 });
    const d = useWorld.getState().draft;
    if (d) {
      const patch: Partial<SpotDraft> = {};
      if (!d.city.trim() && r.city) patch.city = r.city;
      if (!d.country.trim() && r.country) patch.country = r.country;
      if (!d.title.trim() && r.name) patch.title = r.name;
      if (Object.keys(patch).length) updateDraft(patch);
    }
  }

  return (
    <div ref={boxRef} className="pointer-events-auto absolute inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-20 mx-auto max-w-md">
      <div className={`flex h-12 items-center gap-2.5 rounded-2xl px-4 ${glass}`}>
        <SearchIcon size={18} className="shrink-0 opacity-60" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          placeholder="Search a place…"
          enterKeyHint="search"
          autoCorrect="off"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-cream-50 outline-none placeholder:text-cream-50/45"
        />
        {loading ? (
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-cream-50/25 border-t-cream-50" />
        ) : (
          q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setShowList(false);
              }}
              aria-label="Clear" className="shrink-0 opacity-60 active:scale-90">
              <XIcon size={16} />
            </button>
          )
        )}
      </div>

      <AnimatePresence>
        {showList && (results.length > 0 || error) && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={`mt-2 max-h-[45dvh] overflow-y-auto rounded-2xl py-1.5 ${glass}`}
          >
            {error && results.length === 0 ? (
              <li className="px-4 py-3 text-[13px] text-cream-50/65">{error}</li>
            ) : (
              results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition active:bg-white/10"
                  >
                    <PinIcon size={17} className="mt-0.5 shrink-0 opacity-60" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{r.name}</span>
                      {r.detail && <span className="block truncate text-xs text-cream-50/55">{r.detail}</span>}
                    </span>
                  </button>
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>

      {!q && (
        <p className="mt-2 text-center text-xs font-medium text-cream-50/70 drop-shadow">or move the map until the pin sits on the spot</p>
      )}
    </div>
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
          <PlaceSearch />
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
              Cancel
            </button>
            <button
              onClick={confirm}
              className="mb-2 h-14 max-w-xs flex-1 rounded-2xl bg-cream-50 px-5 text-[15px] font-medium tracking-tight text-night-950 shadow-lg active:scale-95"
            >
              Use this spot
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
