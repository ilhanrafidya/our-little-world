'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useAnimate, AnimatePresence } from 'framer-motion';

/** PRNG deterministik → posisi bintang sama di server & client (tanpa hydration mismatch). */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export default function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [scope, animate] = useAnimate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const stars = useMemo(() => {
    const rand = seeded(42);
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: `${rand() * 100}%`,
      top: `${rand() * 100}%`,
      size: rand() * 2 + 1,
      delay: `${rand() * 4}s`,
      duration: `${rand() * 3 + 2}s`,
    }));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      if (res.ok) {
        setSuccess(true);
        // beri waktu animasi "terbuka" sebelum pindah halaman
        setTimeout(() => {
          router.replace(next);
          router.refresh();
        }, 650);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Ada yang salah, coba lagi.');
      setPasscode('');
      animate(scope.current, { x: [0, -12, 12, -8, 8, -4, 4, 0] }, { duration: 0.45 });
      navigator.vibrate?.(120);
      inputRef.current?.focus();
    } catch {
      setError('Tidak ada koneksi. Cek internet kamu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-b from-night-950 via-night-900 to-night-800 px-6 pt-safe pb-safe">
      {/* langit berbintang */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full bg-cream-50"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animation: `twinkle ${s.duration} ease-in-out ${s.delay} infinite`,
            }}
          />
        ))}
        <div className="absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blush-500/20 blur-3xl" />
      </div>

      <AnimatePresence>
        {!success && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm text-center"
          >
            <motion.div
              aria-hidden
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
              className="mx-auto mb-6 h-16 w-16 rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffd3b0,#ff7a9c_45%,#17173a_75%)] shadow-[0_0_40px_rgba(255,122,156,0.45)]"
            />

            <h1 className="font-display text-4xl italic tracking-tight text-cream-50">Our Little World</h1>
            <p className="mt-2 font-hand text-xl text-blush-300">peta kecil milik kita berdua</p>

            <form ref={scope} onSubmit={onSubmit} className="mt-10 space-y-4">
              <label htmlFor="passcode" className="sr-only">
                Kode rahasia
              </label>
              <input
                ref={inputRef}
                id="passcode"
                name="passcode"
                type="password"
                autoComplete="current-password"
                autoFocus
                enterKeyHint="go"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="kode rahasia kita"
                // text-base (16px) mencegah auto-zoom Safari iOS saat input difokuskan
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center text-base tracking-[0.3em] text-cream-50 placeholder:tracking-normal placeholder:text-cream-50/35 backdrop-blur-md outline-none transition focus:border-blush-400/60 focus:bg-white/10 focus:ring-4 focus:ring-blush-500/15"
              />

              <button
                type="submit"
                disabled={!passcode || loading}
                className="w-full rounded-2xl bg-linear-to-r from-blush-500 to-peach-300 px-5 py-4 font-medium text-night-950 shadow-lg shadow-blush-500/25 transition active:scale-[0.98] disabled:opacity-40"
              >
                {loading ? 'Membuka…' : 'Buka dunia kita ✨'}
              </button>

              <p role="alert" aria-live="polite" className="min-h-6 text-sm text-blush-300">
                {error}
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
