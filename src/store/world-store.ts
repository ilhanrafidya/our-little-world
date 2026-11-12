'use client';

import { create } from 'zustand';
import type { Memory } from '@/types/memory';
import type { Bounds, LatLngTuple } from '@/lib/geo';

export type WorldMode = 'globe' | 'map';

export interface MapRequest {
  center: LatLngTuple;
  zoom?: number;
  bounds?: Bounds;
  nonce: number;
}

interface WorldState {
  /** null = pakai data dari server (props). Diisi saat ada perubahan di client (Tahap 4). */
  memories: Memory[] | null;
  mode: WorldMode;
  focusCityKey: string | null;
  /** posisi terakhir peta 2D — dipakai animasi "terbang keluar" saat Back to Globe */
  mapView: { lat: number; lng: number; zoom: number } | null;
  mapRequest: MapRequest | null;
  selectedMemoryId: string | null;
  journey: { playing: boolean; index: number };

  setMemories: (memories: Memory[]) => void;
  enterMap: (opts: { cityKey?: string | null; center: LatLngTuple; zoom?: number; bounds?: Bounds }) => void;
  backToGlobe: () => void;
  setMapView: (v: { lat: number; lng: number; zoom: number }) => void;
  select: (id: string | null) => void;
  startJourney: () => void;
  stopJourney: () => void;
  setJourneyIndex: (i: number) => void;
}

let nonce = 0;

export const useWorld = create<WorldState>((set, get) => ({
  memories: null,
  mode: 'globe',
  focusCityKey: null,
  mapView: null,
  mapRequest: null,
  selectedMemoryId: null,
  journey: { playing: false, index: -1 },

  setMemories: (memories) => set({ memories }),

  enterMap: ({ cityKey = null, center, zoom, bounds }) =>
    set({
      mode: 'map',
      focusCityKey: cityKey,
      mapRequest: { center, zoom, bounds, nonce: ++nonce },
      mapView: { lat: center[0], lng: center[1], zoom: zoom ?? 13 },
      journey: { playing: false, index: -1 },
    }),

  backToGlobe: () => {
    if (get().mode === 'globe') return;
    set({ mode: 'globe', focusCityKey: null, selectedMemoryId: null });
  },

  setMapView: (mapView) => set({ mapView }),

  select: (selectedMemoryId) => set({ selectedMemoryId }),

  startJourney: () => set({ journey: { playing: true, index: -1 }, selectedMemoryId: null }),
  stopJourney: () => set({ journey: { playing: false, index: -1 } }),
  setJourneyIndex: (index) => set((s) => ({ journey: { ...s.journey, index } })),
}));
