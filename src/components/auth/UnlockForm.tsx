'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useAnimate, AnimatePresence } from 'framer-motion';
import Starfield from '@/components/ui/Starfield';
import { ArrowRightIcon } from '@/components/ui/icons';

const EARTH = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg';

/** Bumi mini berputar: tekstur dunia digeser horizontal + bayangan agar terlihat bulat. */
function Earth() {
  return (
    <div className="relative mx-auto mb-8 h-24 w-24">
      <div className="absolute -inset-4 rounded-full bg-blush-500/25 blur-2xl" />
      <div
        className="relative h-full w-full rounded-full"
        style={{
          backgroundImage: `url(${EARTH})`,
          backgroundSize: '200% 100%',
          backgroundRepeat: 'repeat-x',
          animation: 'earth-spin 40s linear infinite',
          boxShadow:
            'inset -18px -10px 28px rgba(0,0,0,0.75), inset 8px 6px 16px rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.08), 0 0 40px rgba(255,122,156,0.35)',
        }}
      />
      {/* atmosfer tipis */}
      <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_14px_3px_rgba(159,211,255,0.35)]" />
    </div>
  );
}

export default function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [scope, animate] = useAnimate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
        setTimeout(() => {
          router.replace(next);
          router.refresh();
        }, 650);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(res.status === 429 ? (data.error ?? 'Too many attempts. Try again later.') : 'Wrong password. Try again.');
      setPasscode('');
      animate(scope.current, { x: [0, -10, 10, -7, 7, -3, 3, 0] }, { duration: 0.45 });
      navigator.vibrate?.(120);
      inputRef.current?.focus();
    } catch {
      setError('No connection. Check your internet.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-b from-night-950 via-night-900 to-night-800 px-6 pt-safe pb-safe">
      <Starfield />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blush-500/15 blur-3xl" />

      <AnimatePresence>
        {!success && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xs text-center"
          >
            <Earth />

            <h1 className="font-display text-4xl italic tracking-tight text-cream-50">Our Little World</h1>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.35em] text-cream-50/50">
              Every place, together
            </p>

            <form ref={scope} onSubmit={onSubmit} className="mt-10 space-y-3">
              <label htmlFor="passcode" className="sr-only">
                Password
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
                placeholder="Password"
                // text-base (16px) mencegah auto-zoom Safari iOS
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center text-base text-cream-50 placeholder:text-cream-50/35 backdrop-blur-md outline-none transition focus:border-white/25 focus:bg-white/10"
              />

              <button
                type="submit"
                disabled={!passcode || loading}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-cream-50 px-5 py-4 text-[15px] font-medium tracking-tight text-night-950 transition active:scale-[0.98] disabled:opacity-35"
              >
                {loading ? 'Opening…' : 'Open our world'}
                {!loading && <ArrowRightIcon size={18} />}
              </button>

              <p role="alert" aria-live="polite" className="min-h-5 text-sm text-blush-300">
                {error}
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
