'use client';

/** Waktu kenangan terbaru yang sudah "dilihat" HP ini (untuk penanda New). */
const KEY = 'olw-seen';

export function getSeen(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markSeen(iso: string | null | undefined) {
  if (!iso) return;
  try {
    const cur = localStorage.getItem(KEY);
    if (!cur || iso > cur) localStorage.setItem(KEY, iso);
  } catch {}
}
