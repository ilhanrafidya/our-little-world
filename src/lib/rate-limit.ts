/**
 * Rate limit sederhana untuk endpoint unlock (in-memory, per instance serverless).
 * Cukup untuk aplikasi privat 2 orang: memperlambat tebak-tebakan passcode.
 * 5 kali salah → kunci 30 dtk, lalu berlipat (60, 120, ...) maks 15 menit.
 */

interface Entry {
  fails: number;
  lockedUntil: number;
  lastFail: number;
}

const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;
const RESET_AFTER_MS = 60 * 60_000; // lupakan percobaan lama setelah 1 jam

const store = new Map<string, Entry>();

function prune(now: number) {
  if (store.size < 500) return;
  for (const [k, v] of store) if (now - v.lastFail > RESET_AFTER_MS) store.delete(k);
}

export function checkLock(key: string): { locked: boolean; retryAfter: number } {
  const e = store.get(key);
  const now = Date.now();
  if (!e) return { locked: false, retryAfter: 0 };
  if (now - e.lastFail > RESET_AFTER_MS) {
    store.delete(key);
    return { locked: false, retryAfter: 0 };
  }
  if (e.lockedUntil > now) return { locked: true, retryAfter: Math.ceil((e.lockedUntil - now) / 1000) };
  return { locked: false, retryAfter: 0 };
}

/** Catat gagal. Mengembalikan detik penguncian (0 jika belum dikunci). */
export function registerFail(key: string): number {
  const now = Date.now();
  prune(now);
  const e = store.get(key) ?? { fails: 0, lockedUntil: 0, lastFail: now };
  e.fails += 1;
  e.lastFail = now;
  if (e.fails >= FREE_ATTEMPTS) {
    const lockMs = Math.min(BASE_LOCK_MS * 2 ** (e.fails - FREE_ATTEMPTS), MAX_LOCK_MS);
    e.lockedUntil = now + lockMs;
  }
  store.set(key, e);
  return e.lockedUntil > now ? Math.ceil((e.lockedUntil - now) / 1000) : 0;
}

export function registerSuccess(key: string) {
  store.delete(key);
}
