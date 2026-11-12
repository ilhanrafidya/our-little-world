'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorld, type SpotDraft } from '@/store/world-store';
import { apiCreateMemory, apiUpdateMemory, ApiError, uploadPhoto, type FieldError, type MemoryPayload } from '@/lib/api-client';
import { getCurrentLocation, reverseGeocode } from '@/lib/geocode';
import { parseSpotifyTrackId } from '@/lib/spotify';
import type { MemoryPhoto } from '@/types/memory';

const input =
  'w-full rounded-xl border border-night-950/10 bg-white px-3.5 py-3 text-base text-night-950 outline-none transition placeholder:text-night-950/35 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15';
const label = 'mb-1.5 block text-sm font-medium text-night-950/70';

type Stage = 'idle' | 'compress' | 'upload' | 'save';
const STAGE_LABEL: Record<Stage, string> = {
  idle: '',
  compress: 'Mengecilkan foto…',
  upload: 'Mengunggah foto…',
  save: 'Menyimpan kenangan…',
};

export default function AddSpotDrawer() {
  const editor = useWorld((s) => s.editor);
  const draft = useWorld((s) => s.draft);
  const updateDraft = useWorld((s) => s.updateDraft);
  const closeEditor = useWorld((s) => s.closeEditor);
  const startPicking = useWorld((s) => s.startPicking);
  const upsertMemory = useWorld((s) => s.upsertMemory);
  const enterMap = useWorld((s) => s.enterMap);
  const select = useWorld((s) => s.select);

  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const visible = editor.open && !editor.picking && !!draft;
  const busy = stage !== 'idle';
  const fe = (f: string) => fieldErrors.find((e) => e.field === f)?.message;

  function set<K extends keyof SpotDraft>(key: K, value: SpotDraft[K]) {
    updateDraft({ [key]: value } as Partial<SpotDraft>);
  }

  async function fillCityFrom(lat: number, lng: number) {
    const current = useWorld.getState().draft;
    if (current?.city.trim()) return;
    const { city, country } = await reverseGeocode(lat, lng);
    const latest = useWorld.getState().draft;
    if (latest && !latest.city.trim() && city) updateDraft({ city, country: latest.country || country || '' });
  }

  async function useMyLocation() {
    setLocating(true);
    setLocError(null);
    try {
      const pos = await getCurrentLocation();
      updateDraft({ lat: pos.lat, lng: pos.lng });
      void fillCityFrom(pos.lat, pos.lng);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Lokasi tidak ditemukan.');
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

    // Validasi ringan di HP sebelum upload
    const local: FieldError[] = [];
    if (!draft.title.trim()) local.push({ field: 'title', message: 'Judul tempat wajib diisi' });
    if (!draft.city.trim()) local.push({ field: 'city', message: 'Nama kota wajib diisi' });
    if (draft.lat == null || draft.lng == null) local.push({ field: 'location', message: 'Tentukan lokasi dulu' });
    if (draft.spotifyUrl.trim() && !parseSpotifyTrackId(draft.spotifyUrl))
      local.push({ field: 'spotifyUrl', message: 'Harus link lagu Spotify (Share → Copy Song Link)' });
    if (local.length) {
      setFieldErrors(local);
      return;
    }

    try {
      let photo: MemoryPhoto | null | undefined = undefined; // undefined = tidak diubah
      if (draft.photoFile) {
        photo = await uploadPhoto(draft.photoFile, (s) => setStage(s));
      } else if (draft.removePhoto) {
        photo = null;
      }

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
        editor.mode === 'edit' && editor.memoryId
          ? await apiUpdateMemory(editor.memoryId, payload)
          : await apiCreateMemory(payload);

      upsertMemory(saved);
      closeEditor();
      // Terbang ke kenangan yang baru disimpan lalu buka Polaroid-nya
      enterMap({ cityKey: saved.cityKey, center: [saved.lat, saved.lng], zoom: 16 });
      setTimeout(() => select(saved.id), 900);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields);
      } else {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && closeEditor()}
        >
          <motion.form
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-cream-50 text-night-950 shadow-2xl md:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <span className="mx-auto mb-1 block h-1.5 w-10 rounded-full bg-night-950/15 md:hidden" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <h2 className="font-display text-2xl italic">
                {editor.mode === 'edit' ? 'Edit kenangan' : 'Kenangan baru ✨'}
              </h2>
              <button
                type="button"
                onClick={closeEditor}
                disabled={busy}
                className="rounded-full p-2 text-night-950/60 active:scale-90"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-4">
              {/* Foto */}
              <div>
                <span className={label}>Foto</span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                {draft.photoPreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.photoPreview} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur"
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-night-950/15 bg-white text-night-950/50 active:scale-[0.99]"
                  >
                    <span className="text-3xl">📷</span>
                    <span className="text-sm">Pilih dari galeri / ambil foto</span>
                  </button>
                )}
              </div>

              {/* Lokasi */}
              <div>
                <span className={label}>Lokasi</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="rounded-xl bg-night-950 px-3 py-3 text-sm font-medium text-cream-50 active:scale-[0.98] disabled:opacity-60"
                  >
                    {locating ? 'Mencari…' : '📍 Lokasi saat ini'}
                  </button>
                  <button
                    type="button"
                    onClick={startPicking}
                    className="rounded-xl border border-night-950/15 bg-white px-3 py-3 text-sm font-medium active:scale-[0.98]"
                  >
                    🗺️ Pilih di peta
                  </button>
                </div>
                <p className={`mt-2 text-xs ${draft.lat != null ? 'text-night-950/60' : 'text-night-950/40'}`}>
                  {draft.lat != null && draft.lng != null
                    ? `✓ ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`
                    : 'Belum ada titik lokasi'}
                </p>
                {(locError || fe('location')) && <p className="mt-1 text-xs text-red-600">{locError ?? fe('location')}</p>}
              </div>

              {/* Status */}
              <div>
                <span className={label}>Status</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-night-950/5 p-1">
                  {(['visited', 'wishlist'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      className={`rounded-lg py-2.5 text-sm font-medium transition ${
                        draft.status === s ? 'bg-white shadow' : 'text-night-950/50'
                      }`}
                    >
                      {s === 'visited' ? '💗 Sudah dikunjungi' : '⭐ Wishlist'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={label} htmlFor="title">
                  Judul tempat
                </label>
                <input
                  id="title"
                  className={input}
                  value={draft.title}
                  maxLength={120}
                  placeholder="mis. Kopi pertama kita"
                  onChange={(e) => set('title', e.target.value)}
                />
                {fe('title') && <p className="mt-1 text-xs text-red-600">{fe('title')}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="city">
                    Kota
                  </label>
                  <input
                    id="city"
                    className={input}
                    value={draft.city}
                    maxLength={80}
                    placeholder="Depok"
                    onChange={(e) => set('city', e.target.value)}
                  />
                  {fe('city') && <p className="mt-1 text-xs text-red-600">{fe('city')}</p>}
                </div>
                <div>
                  <label className={label} htmlFor="date">
                    Tanggal
                  </label>
                  <input
                    id="date"
                    type="date"
                    className={input}
                    value={draft.memoryDate}
                    onChange={(e) => set('memoryDate', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className={label} htmlFor="story">
                  Cerita
                </label>
                <textarea
                  id="story"
                  rows={4}
                  maxLength={5000}
                  className={`${input} resize-none`}
                  value={draft.story}
                  placeholder="Apa yang kalian ingat dari tempat ini?"
                  onChange={(e) => set('story', e.target.value)}
                />
              </div>

              <div>
                <label className={label} htmlFor="spotify">
                  Link lagu Spotify <span className="font-normal text-night-950/40">(opsional)</span>
                </label>
                <input
                  id="spotify"
                  inputMode="url"
                  className={input}
                  value={draft.spotifyUrl}
                  placeholder="https://open.spotify.com/track/…"
                  onChange={(e) => set('spotifyUrl', e.target.value)}
                />
                {fe('spotifyUrl') && <p className="mt-1 text-xs text-red-600">{fe('spotifyUrl')}</p>}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-night-950/10 px-5 pb-safe pt-3">
              {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mb-1 w-full rounded-2xl bg-linear-to-r from-[var(--accent)] to-[var(--accent2)] py-4 font-semibold text-night-950 shadow-lg active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? STAGE_LABEL[stage] : editor.mode === 'edit' ? 'Simpan perubahan' : 'Simpan kenangan 💗'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
