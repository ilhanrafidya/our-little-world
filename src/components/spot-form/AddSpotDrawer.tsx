'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { useWorld, type SpotDraft } from '@/store/world-store';
import { apiCreateMemory, apiUpdateMemory, ApiError, uploadPhoto, type FieldError, type MemoryPayload } from '@/lib/api-client';
import { getCurrentLocation, reverseGeocode } from '@/lib/geocode';
import { parseSpotifyTrackId } from '@/lib/spotify';
import type { MemoryPhoto } from '@/types/memory';
import { CameraIcon, HeartIcon, MapIcon, PinIcon, StarIcon, XIcon } from '@/components/ui/icons';

const field =
  'w-full rounded-2xl border border-night-950/[0.08] bg-white px-4 py-3.5 text-base text-night-950 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-night-950/30 focus:border-night-950/25 focus:shadow-[0_0_0_4px_rgba(23,23,58,0.06)]';
const labelCls = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-night-950/45';
const errCls = 'mt-1.5 text-xs text-[#d6336c]';

type Stage = 'idle' | 'compress' | 'upload' | 'save';
const STAGE_LABEL: Record<Stage, string> = {
  idle: '',
  compress: 'Preparing photo…',
  upload: 'Uploading photo…',
  save: 'Saving…',
};

const ease = [0.22, 1, 0.36, 1] as const;

function todayIso() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Teks form berbeda untuk kenangan (Visited) dan rencana (Wishlist). */
const COPY = {
  visited: {
    eyebrow: 'New memory',
    heading: 'Save a place',
    editHeading: 'Update this memory',
    placePh: 'The café on the corner',
    dateLabel: 'Date',
    storyLabel: 'Story',
    storyPh: 'What do you remember most about this place?',
    songLabel: 'Our song',
    submit: 'Save memory',
  },
  wishlist: {
    eyebrow: 'Wishlist',
    heading: 'Somewhere we’ll go',
    editHeading: 'Update this wish',
    placePh: 'Sunset at Uluwatu',
    dateLabel: 'When (optional)',
    storyLabel: 'Why we want to go',
    storyPh: 'What do you want to do there together?',
    songLabel: 'Song for the trip',
    submit: 'Add to wishlist',
  },
} as const;

export default function AddSpotDrawer() {
  const editor = useWorld((s) => s.editor);
  const draft = useWorld((s) => s.draft);
  const updateDraft = useWorld((s) => s.updateDraft);
  const closeEditor = useWorld((s) => s.closeEditor);
  const startPicking = useWorld((s) => s.startPicking);
  const upsertMemory = useWorld((s) => s.upsertMemory);
  const enterMap = useWorld((s) => s.enterMap);
  const select = useWorld((s) => s.select);

  const dragControls = useDragControls();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const visible = editor.open && !editor.picking && !!draft;
  const busy = stage !== 'idle';
  const fe = (f: string) => fieldErrors.find((e) => e.field === f)?.message;
  const isEdit = editor.mode === 'edit';
  const isWish = draft?.status === 'wishlist';
  const copy = COPY[draft?.status ?? 'visited'];

  function set<K extends keyof SpotDraft>(key: K, value: SpotDraft[K]) {
    updateDraft({ [key]: value } as Partial<SpotDraft>);
  }

  function changeStatus(status: SpotDraft['status']) {
    if (!draft || draft.status === status) return;
    const patch: Partial<SpotDraft> = { status };
    // Wishlist belum terjadi → tanggal hari ini tidak relevan
    if (status === 'wishlist' && draft.memoryDate === todayIso()) patch.memoryDate = '';
    if (status === 'visited' && !draft.memoryDate) patch.memoryDate = todayIso();
    updateDraft(patch);
  }

  function close() {
    // Jangan tutup saat sedang memilih titik di peta (sisa animasi keluar bisa menangkap tap)
    if (busy || useWorld.getState().editor.picking) return;
    setError(null);
    setFieldErrors([]);
    setLocError(null);
    closeEditor();
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) close();
  }

  async function useMyLocation() {
    setLocating(true);
    setLocError(null);
    try {
      const pos = await getCurrentLocation();
      updateDraft({ lat: pos.lat, lng: pos.lng });
      if (!useWorld.getState().draft?.city.trim()) {
        const { city, country } = await reverseGeocode(pos.lat, pos.lng);
        const latest = useWorld.getState().draft;
        if (latest && !latest.city.trim() && city) updateDraft({ city, country: latest.country || country || '' });
      }
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Location not found.');
    } finally {
      setLocating(false);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft) return;
    if (draft.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(draft.photoPreview);
    updateDraft({ photoFile: file, photoPreview: URL.createObjectURL(file), removePhoto: false });
  }

  function removePhoto() {
    if (!draft) return;
    if (draft.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(draft.photoPreview);
    updateDraft({ photoFile: null, photoPreview: null, removePhoto: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || busy) return;
    setError(null);
    setFieldErrors([]);

    const local: FieldError[] = [];
    if (!draft.title.trim()) local.push({ field: 'title', message: 'Please add a place name' });
    if (!draft.city.trim()) local.push({ field: 'city', message: 'Please add a city' });
    if (draft.lat == null || draft.lng == null) local.push({ field: 'location', message: 'Set a location first' });
    if (draft.spotifyUrl.trim() && !parseSpotifyTrackId(draft.spotifyUrl))
      local.push({ field: 'spotifyUrl', message: 'Use a song link: Share → Copy Song Link' });
    if (local.length) {
      setFieldErrors(local);
      return;
    }

    try {
      let photo: MemoryPhoto | null | undefined = undefined; // undefined = tidak diubah
      if (draft.photoFile && draft.status === 'visited') photo = await uploadPhoto(draft.photoFile, (s) => setStage(s));
      else if (draft.removePhoto) photo = null;

      setStage('save');
      const payload: MemoryPayload = {
        title: draft.title.trim(),
        city: draft.city.trim(),
        country: draft.country.trim() || null,
        lat: draft.lat!,
        lng: draft.lng!,
        status: draft.status,
        memoryDate: draft.memoryDate || null,
        story: draft.story.trim() || null,
        spotifyUrl: draft.spotifyUrl.trim() || null,
        ...(photo !== undefined ? { photo } : {}),
      };

      const saved =
        isEdit && editor.memoryId ? await apiUpdateMemory(editor.memoryId, payload) : await apiCreateMemory(payload);

      upsertMemory(saved);
      closeEditor();
      enterMap({ cityKey: saved.cityKey, center: [saved.lat, saved.lng], zoom: 16 });
      setTimeout(() => select(saved.id), 900);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : 'Could not save.');
      }
    } finally {
      setStage('idle');
    }
  }

  return (
    <AnimatePresence>
      {visible && draft && (
        <motion.div
          key="drawer"
          className="fixed inset-0 z-50 flex items-end justify-center bg-night-950/40 backdrop-blur-[6px] md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.3 }}
          onClick={close}
        >
          <motion.form
            onSubmit={onSubmit}
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
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-[#faf7f2] text-night-950 shadow-[0_-20px_60px_rgba(0,0,0,0.35)] md:rounded-[28px]"
          >
            {/* Handle + header (area untuk geser turun menutup) */}
            <div
              className="touch-none cursor-grab select-none px-6 pb-4 pt-3 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-night-950/15 md:hidden" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-night-950/40">
                    {isEdit ? 'Edit' : copy.eyebrow}
                  </p>
                  <h2 className="mt-1 text-[22px] font-semibold tracking-tight">
                    {isEdit ? copy.editHeading : copy.heading}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night-950/[0.06] text-night-950/60 transition active:scale-90"
                  aria-label="Close"
                >
                  <XIcon size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 pb-6">
              {/* Status */}
              <section>
                <span className={labelCls}>Status</span>
                <div className="relative grid grid-cols-2 rounded-2xl bg-night-950/[0.05] p-1">
                  {(['visited', 'wishlist'] as const).map((s) => {
                    const active = draft.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => changeStatus(s)}
                        className="relative z-10 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium"
                      >
                        {active && (
                          <motion.span
                            layoutId="status-pill"
                            className="absolute inset-0 -z-10 rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                          />
                        )}
                        <span className={active ? 'text-night-950' : 'text-night-950/45'}>
                          {s === 'visited' ? <HeartIcon size={16} /> : <StarIcon size={16} />}
                        </span>
                        <span className={active ? 'text-night-950' : 'text-night-950/45'}>
                          {s === 'visited' ? 'Visited' : 'Wishlist'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Foto — hanya untuk Visited */}
              <AnimatePresence initial={false}>
                {!isWish && (
                  <motion.div
                    key="photo-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease }}
                    className="overflow-hidden"
                  >
                    <section>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                <AnimatePresence mode="wait" initial={false}>
                  {draft.photoPreview ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="relative overflow-hidden rounded-3xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.photoPreview} alt="" className="aspect-[4/3] w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-linear-to-t from-black/50 to-transparent p-3 pt-10">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-medium text-night-950 backdrop-blur transition active:scale-95"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="rounded-full bg-black/45 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur transition active:scale-95"
                        >
                          Remove
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="empty"
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => fileRef.current?.click()}
                      className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-night-950/15 bg-white text-night-950/45 transition active:scale-[0.99]"
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-night-950/[0.05]">
                        <CameraIcon size={22} />
                      </span>
                      <span className="text-sm font-medium">Add a photo</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </section>

                  </motion.div>
                )}
              </AnimatePresence>

              {/* Detail */}
              <section className="space-y-4">
                <div>
                  <label className={labelCls} htmlFor="title">
                    Place
                  </label>
                  <input
                    id="title"
                    className={field}
                    value={draft.title}
                    maxLength={120}
                    placeholder={copy.placePh}
                    onChange={(e) => set('title', e.target.value)}
                  />
                  {fe('title') && <p className={errCls}>{fe('title')}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} htmlFor="city">
                      City
                    </label>
                    <input
                      id="city"
                      className={field}
                      value={draft.city}
                      maxLength={80}
                      placeholder="Depok"
                      onChange={(e) => set('city', e.target.value)}
                    />
                    {fe('city') && <p className={errCls}>{fe('city')}</p>}
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="date">
                      {copy.dateLabel}
                    </label>
                    <input
                      id="date"
                      type="date"
                      className={`${field} min-h-[54px]`}
                      value={draft.memoryDate}
                      onChange={(e) => set('memoryDate', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Lokasi */}
              <section>
                <span className={labelCls}>Location</span>
                <div className="overflow-hidden rounded-2xl border border-night-950/[0.08] bg-white">
                  <div className="grid grid-cols-2 divide-x divide-night-950/[0.08]">
                    <button
                      type="button"
                      onClick={useMyLocation}
                      disabled={locating}
                      className="flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition active:bg-night-950/[0.04] disabled:opacity-50"
                    >
                      <PinIcon size={17} /> {locating ? 'Locating…' : 'Current location'}
                    </button>
                    <button
                      type="button"
                      onClick={startPicking}
                      className="flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition active:bg-night-950/[0.04]"
                    >
                      <MapIcon size={17} /> Pick on map
                    </button>
                  </div>
                  <div className="border-t border-night-950/[0.08] px-4 py-2.5 text-xs tabular-nums text-night-950/50">
                    {draft.lat != null && draft.lng != null ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                      </span>
                    ) : (
                      'No location yet'
                    )}
                  </div>
                </div>
                {(locError || fe('location')) && <p className={errCls}>{locError ?? fe('location')}</p>}
              </section>

              {/* Cerita & lagu */}
              <section className="space-y-4">
                <div>
                  <label className={labelCls} htmlFor="story">
                    {copy.storyLabel}
                  </label>
                  <textarea
                    id="story"
                    rows={4}
                    maxLength={5000}
                    className={`${field} resize-none leading-relaxed`}
                    value={draft.story}
                    placeholder={copy.storyPh}
                    onChange={(e) => set('story', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="spotify">
                    {copy.songLabel} <span className="normal-case tracking-normal text-night-950/30">— optional</span>
                  </label>
                  <input
                    id="spotify"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className={field}
                    value={draft.spotifyUrl}
                    placeholder="open.spotify.com/track/…"
                    onChange={(e) => set('spotifyUrl', e.target.value)}
                  />
                  {fe('spotifyUrl') && <p className={errCls}>{fe('spotifyUrl')}</p>}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="border-t border-night-950/[0.06] bg-[#faf7f2]/95 px-6 pb-safe pt-3 backdrop-blur">
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-2 text-sm text-[#d6336c]"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <button
                type="submit"
                disabled={busy}
                className="relative mb-1 h-14 w-full overflow-hidden rounded-2xl bg-night-950 text-[15px] font-medium tracking-tight text-cream-50 transition active:scale-[0.985] disabled:opacity-70"
              >
                {busy && (
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-white/10"
                    initial={{ width: '0%' }}
                    animate={{ width: stage === 'compress' ? '30%' : stage === 'upload' ? '75%' : '95%' }}
                    transition={{ duration: 0.8, ease }}
                  />
                )}
                <span className="relative">
                  {busy ? STAGE_LABEL[stage] : isEdit ? 'Save changes' : copy.submit}
                </span>
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
