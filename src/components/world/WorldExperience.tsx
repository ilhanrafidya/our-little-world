'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Memory } from '@/types/memory';
import { buildArcs, buildJourney, groupByCity } from '@/lib/geo';
import { useWorld } from '@/store/world-store';
import Starfield from '@/components/ui/Starfield';
import GlobeView from './GlobeView';
import MapView from './MapView';
import { useTimeTheme } from './useTimeTheme';
import { AddSpotFab, GlobeHint, JourneyControls, PickOverlay, TopBar } from './Overlays';
import PolaroidModal from '@/components/memory/PolaroidModal';
import AddSpotDrawer from '@/components/spot-form/AddSpotDrawer';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Orkestrator Hybrid Map.
 * Satu sumber data (memories) → diturunkan jadi cities/journey/arcs untuk Globe,
 * dan pin detail untuk Peta 2D. Mode & seleksi dibagi lewat Zustand store.
 */
export default function WorldExperience({ initialMemories }: { initialMemories: Memory[] }) {
  const stored = useWorld((s) => s.memories);
  const memories = stored ?? initialMemories;

  // Data server → store client (setelah itu tambah/edit/hapus langsung memperbarui globe & peta)
  useEffect(() => {
    useWorld.getState().setMemories(initialMemories);
  }, [initialMemories]);

  const cities = useMemo(() => groupByCity(memories), [memories]);
  const journey = useMemo(() => buildJourney(cities), [cities]);
  const arcs = useMemo(() => buildArcs(journey, cities), [journey, cities]);

  const { phase, tokens, override, cycle } = useTimeTheme();
  const mode = useWorld((s) => s.mode);
  const selectedId = useWorld((s) => s.selectedMemoryId);
  const selected = useMemo(() => memories.find((m) => m.id === selectedId) ?? null, [memories, selectedId]);

  // Opsi garis rute (default mati agar Play Journey terasa "mengungkap")
  const [showRoutes, setShowRoutes] = useState(false);
  useEffect(() => {
    try {
      setShowRoutes(localStorage.getItem('olw-routes') === '1');
    } catch {
      /* abaikan */
    }
  }, []);
  const toggleRoutes = () =>
    setShowRoutes((v) => {
      try {
        localStorage.setItem('olw-routes', v ? '0' : '1');
      } catch {
        /* abaikan */
      }
      return !v;
    });

  // Leaflet baru di-mount saat pertama kali masuk peta, lalu dipertahankan
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(() => {
    if (mode === 'map') setMapMounted(true);
  }, [mode]);

  const cssVars = {
    '--accent': tokens.accent,
    '--accent2': tokens.accent2,
    '--wish': tokens.wish,
    '--panel': tokens.panel,
  } as CSSProperties;

  const isGlobe = mode === 'globe';

  return (
    <main className="fixed left-0 top-0 h-lvh w-full overflow-hidden text-cream-50" style={cssVars} data-phase={phase}>
      {/* Langit (berganti sesuai jam) */}
      <div className="absolute inset-0 transition-[background] duration-1000" style={{ background: tokens.sky }} />
      <Starfield opacity={tokens.stars} />

      {/* Layer Globe 3D — tetap ter-mount agar WebGL tidak dibuat ulang (penting di iOS) */}
      <motion.div
        className="absolute inset-0 isolate z-0"
        initial={false}
        animate={{ opacity: isGlobe ? 1 : 0, scale: isGlobe ? 1 : 1.3 }}
        transition={{ duration: 0.7, ease: EASE }}
        style={{ pointerEvents: isGlobe ? 'auto' : 'none' }}
        aria-hidden={!isGlobe}
      >
        <GlobeView cities={cities} arcs={arcs} journey={journey} theme={tokens} showRoutes={showRoutes} />
      </motion.div>

      {/* Layer Peta 2D */}
      {mapMounted && (
        <motion.div
          className="absolute inset-0 isolate z-[1]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: isGlobe ? 0 : 1, scale: isGlobe ? 0.9 : 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ pointerEvents: isGlobe ? 'none' : 'auto' }}
          aria-hidden={isGlobe}
        >
          <MapView memories={memories} theme={tokens} visible={!isGlobe} />
        </motion.div>
      )}

      <TopBar
        phase={phase}
        override={override}
        onCycleTheme={cycle}
        showRoutes={showRoutes}
        onToggleRoutes={toggleRoutes}
        hasRoutes={arcs.length > 0}
      />
      <GlobeHint empty={memories.length === 0} />
      <JourneyControls journey={journey} />
      <AddSpotFab />
      <PickOverlay />
      <PolaroidModal memory={selected} />
      <AddSpotDrawer />
    </main>
  );
}
