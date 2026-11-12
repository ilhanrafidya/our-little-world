'use client';

import { useCallback, useEffect, useState } from 'react';
import { OVERRIDE_ORDER, THEMES, phaseForHour, type Phase, type ThemeOverride } from '@/lib/theme';

const STORAGE_KEY = 'olw-theme';

function isOverride(v: string): v is ThemeOverride {
  return (OVERRIDE_ORDER as string[]).includes(v);
}

/**
 * Tema mengikuti jam lokal device (bukan jam server), dicek ulang tiap menit.
 * Bisa dikunci manual: auto → pagi → siang → senja → malam → auto.
 */
export function useTimeTheme() {
  const [hour, setHour] = useState<number | null>(null);
  const [override, setOverride] = useState<ThemeOverride>('auto');

  useEffect(() => {
    setHour(new Date().getHours());
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isOverride(saved)) setOverride(saved);
    } catch {
      /* storage tidak tersedia (mode privat) — abaikan */
    }
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const phase: Phase = override !== 'auto' ? override : hour === null ? 'night' : phaseForHour(hour);

  const cycle = useCallback(() => {
    setOverride((current) => {
      const next = OVERRIDE_ORDER[(OVERRIDE_ORDER.indexOf(current) + 1) % OVERRIDE_ORDER.length]!;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* abaikan */
      }
      return next;
    });
  }, []);

  return { phase, tokens: THEMES[phase], override, cycle };
}
