'use client';

import { create } from 'zustand';
import type { Memory, MemoryPhoto, MemoryStatus, MemoryWho } from '@/types/memory';
import type { Bounds, LatLngTuple } from '@/lib/geo';

export type WorldMode = 'globe' | 'map';

export interface MapRequest {
  center: LatLngTuple;
  zoom?: number;
  bounds?: Bounds;
  nonce: number;
}

/** Isi form Add/Edit Spot — disimpan di store agar tidak hilang saat memilih titik di peta. */
export interface SpotDraft {
  title: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  status: MemoryStatus;
  who: MemoryWho;
  memoryDate: string;
  story: string;
  spotifyUrl: string;
  photoFile: File | null;
  photoPreview: string | null;
  existingPhoto: MemoryPhoto | null;
  removePhoto: boolean;
}

export type JourneyPhase = 'intro' | 'travel' | 'arrive' | 'outro';
export interface JourneyState {
  playing: boolean;
  /** journey siapa: berdua, Ilhan, atau Nadya */
  who: MemoryWho;
  paused: boolean;
  /** indeks kota tujuan saat ini di daftar journey */
  index: number;
  phase: JourneyPhase | null;
  vehicle: 'plane' | 'car' | null;
  summary: { cities: number; km: number; memories: number } | null;
  skipNonce: number;
}

const IDLE_JOURNEY: JourneyState = {
  playing: false,
  who: 'together',
  paused: false,
  index: -1,
  phase: null,
  vehicle: null,
  summary: null,
  skipNonce: 0,
};

interface EditorState {
  open: boolean;
  mode: 'create' | 'edit';
  memoryId: string | null;
  picking: boolean;
}

interface WorldState {
  /** null = belum di-hydrate dari props server */
  memories: Memory[] | null;
  mode: WorldMode;
  focusCityKey: string | null;
  /** posisi terakhir peta 2D — untuk animasi "terbang keluar" & titik tengah pemilih lokasi */
  mapView: { lat: number; lng: number; zoom: number } | null;
  mapRequest: MapRequest | null;
  selectedMemoryId: string | null;
  journey: JourneyState;
  editor: EditorState;
  draft: SpotDraft | null;
  albumOpen: boolean;
  setAlbumOpen: (open: boolean) => void;
  journeyChoosing: boolean;
  setJourneyChoosing: (v: boolean) => void;
  /** kenangan baru dari pasangan sejak terakhir buka app */
  newIds: string[];
  setNewIds: (ids: string[]) => void;
  clearNew: (id: string) => void;
  notifyOpen: boolean;
  setNotifyOpen: (open: boolean) => void;

  setMemories: (memories: Memory[]) => void;
  upsertMemory: (memory: Memory) => void;
  removeMemory: (id: string) => void;

  enterMap: (opts: { cityKey?: string | null; center: LatLngTuple; zoom?: number; bounds?: Bounds }) => void;
  backToGlobe: () => void;
  setMapView: (v: { lat: number; lng: number; zoom: number }) => void;
  select: (id: string | null) => void;

  startJourney: (who?: MemoryWho) => void;
  stopJourney: () => void;
  setJourney: (patch: Partial<JourneyState>) => void;
  togglePauseJourney: () => void;
  skipJourney: () => void;

  openCreate: () => void;
  openEdit: (memory: Memory) => void;
  closeEditor: () => void;
  updateDraft: (patch: Partial<SpotDraft>) => void;
  startPicking: () => void;
  finishPicking: (lat: number, lng: number) => void;
  cancelPicking: () => void;
}

let nonce = 0;
const DEFAULT_CENTER: LatLngTuple = [-6.2, 106.82]; // Jakarta

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function emptyDraft(lat: number | null, lng: number | null): SpotDraft {
  return {
    title: '',
    city: '',
    country: '',
    lat,
    lng,
    status: 'visited',
    who: 'together',
    memoryDate: today(),
    story: '',
    spotifyUrl: '',
    photoFile: null,
    photoPreview: null,
    existingPhoto: null,
    removePhoto: false,
  };
}

function revokePreview(draft: SpotDraft | null) {
  if (draft?.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(draft.photoPreview);
}

export const useWorld = create<WorldState>((set, get) => ({
  memories: null,
  mode: 'globe',
  focusCityKey: null,
  mapView: null,
  mapRequest: null,
  selectedMemoryId: null,
  journey: IDLE_JOURNEY,
  editor: { open: false, mode: 'create', memoryId: null, picking: false },
  draft: null,
  albumOpen: false,
  setAlbumOpen: (albumOpen) => set({ albumOpen }),
  journeyChoosing: false,
  setJourneyChoosing: (journeyChoosing) => set({ journeyChoosing }),
  newIds: [],
  setNewIds: (newIds) => set({ newIds }),
  clearNew: (id) => set((s) => (s.newIds.includes(id) ? { newIds: s.newIds.filter((x) => x !== id) } : s)),
  notifyOpen: false,
  setNotifyOpen: (notifyOpen) => set({ notifyOpen }),

  // ── data ──
  setMemories: (memories) => set({ memories }),
  upsertMemory: (memory) =>
    set((s) => {
      const list = s.memories ?? [];
      const exists = list.some((m) => m.id === memory.id);
      const next = exists ? list.map((m) => (m.id === memory.id ? memory : m)) : [...list, memory];
      next.sort((a, b) => (a.memoryDate ?? '9999').localeCompare(b.memoryDate ?? '9999'));
      return { memories: next };
    }),
  removeMemory: (id) =>
    set((s) => ({
      memories: (s.memories ?? []).filter((m) => m.id !== id),
      selectedMemoryId: s.selectedMemoryId === id ? null : s.selectedMemoryId,
    })),

  // ── navigasi ──
  enterMap: ({ cityKey = null, center, zoom, bounds }) =>
    set({
      mode: 'map',
      focusCityKey: cityKey,
      mapRequest: { center, zoom, bounds, nonce: ++nonce },
      mapView: { lat: center[0], lng: center[1], zoom: zoom ?? 13 },
      journey: IDLE_JOURNEY,
    }),
  backToGlobe: () => {
    if (get().mode === 'globe' || get().editor.picking) return;
    set({ mode: 'globe', focusCityKey: null, selectedMemoryId: null });
  },
  setMapView: (mapView) => set({ mapView }),
  select: (selectedMemoryId) => set({ selectedMemoryId }),

  // ── journey ──
  startJourney: (who = 'together') => set({ journey: { ...IDLE_JOURNEY, who, playing: true, phase: 'intro' }, selectedMemoryId: null }),
  stopJourney: () => set({ journey: IDLE_JOURNEY }),
  setJourney: (patch) => set((s) => ({ journey: { ...s.journey, ...patch } })),
  togglePauseJourney: () => set((s) => ({ journey: { ...s.journey, paused: !s.journey.paused } })),
  skipJourney: () => set((s) => ({ journey: { ...s.journey, skipNonce: s.journey.skipNonce + 1 } })),

  // ── editor Add/Edit Spot ──
  openCreate: () => {
    const { mode, mapView } = get();
    revokePreview(get().draft);
    set({
      editor: { open: true, mode: 'create', memoryId: null, picking: false },
      draft: emptyDraft(mode === 'map' && mapView ? mapView.lat : null, mode === 'map' && mapView ? mapView.lng : null),
      selectedMemoryId: null,
      journey: IDLE_JOURNEY,
    });
  },
  openEdit: (m) => {
    revokePreview(get().draft);
    set({
      editor: { open: true, mode: 'edit', memoryId: m.id, picking: false },
      draft: {
        title: m.title,
        city: m.city,
        country: m.country ?? '',
        lat: m.lat,
        lng: m.lng,
        status: m.status,
        who: m.who,
        memoryDate: m.memoryDate ?? '',
        story: m.story ?? '',
        spotifyUrl: m.spotifyUrl ?? '',
        photoFile: null,
        photoPreview: m.photo?.url ?? null,
        existingPhoto: m.photo,
        removePhoto: false,
      },
      selectedMemoryId: null,
    });
  },
  closeEditor: () => {
    revokePreview(get().draft);
    set({ editor: { open: false, mode: 'create', memoryId: null, picking: false }, draft: null });
  },
  updateDraft: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : {})),

  // ── pilih titik di peta (form disembunyikan sementara, isi tetap tersimpan) ──
  startPicking: () => {
    const { mode, draft, mapView } = get();
    set((s) => ({ editor: { ...s.editor, picking: true } }));
    const center: LatLngTuple =
      draft?.lat != null && draft.lng != null
        ? [draft.lat, draft.lng]
        : mapView
          ? [mapView.lat, mapView.lng]
          : DEFAULT_CENTER;
    if (mode === 'globe' || draft?.lat != null) {
      get().enterMap({ center, zoom: 16 });
    }
  },
  finishPicking: (lat, lng) =>
    set((s) => ({
      editor: { ...s.editor, picking: false },
      draft: s.draft ? { ...s.draft, lat, lng } : s.draft,
    })),
  cancelPicking: () => set((s) => ({ editor: { ...s.editor, picking: false } })),
}));
