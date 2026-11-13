'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorld } from '@/store/world-store';
import { PEOPLE } from '@/lib/people';
import { BellIcon, XIcon } from '@/components/ui/icons';
import { disablePush, enablePush, getMe, pushStatus, setMe, type Me, type PushStatus } from '@/lib/notify-client';
import { sound } from '@/lib/sound';

const ME_OPTIONS: Me[] = ['ilhan', 'nadya'];

export default function NotifySheet() {
  const open = useWorld((s) => s.notifyOpen);
  const setOpen = useWorld((s) => s.setNotifyOpen);
  const [me, setMeState] = useState<Me | null>(null);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMeState(getMe());
    setError(null);
    pushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, [open]);

  const choose = async (who: Me) => {
    setMe(who);
    setMeState(who);
    sound.tap();
    // sudah langganan → perbarui pemiliknya
    if (status === 'on') {
      try {
        await enablePush(who);
      } catch {
        /* abaikan */
      }
    }
  };

  const turnOn = async () => {
    if (!me) return;
    setBusy(true);
    setError(null);
    try {
      const s = await enablePush(me);
      setStatus(s);
      if (s === 'on') sound.chime();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      setStatus(await disablePush());
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="notify"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-[2px] sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: { type: 'spring', damping: 26, stiffness: 300 } }}
            exit={{ y: 30, opacity: 0, transition: { duration: 0.18 } }}
            className="w-full max-w-sm rounded-[28px] bg-cream-50 p-5 text-night-950 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-linear-to-br from-[var(--accent)] to-[var(--accent2)] text-night-950">
                <BellIcon size={20} />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full bg-night-950/5 active:scale-90"
              >
                <XIcon size={16} />
              </button>
            </div>

            <h2 className="mt-3 text-[19px] font-semibold tracking-tight">Notifications</h2>
            <p className="mt-1 text-[13.5px] leading-snug text-night-950/55">
              Get a little ping when your person pins a new memory.
            </p>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-night-950/40">This phone is</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ME_OPTIONS.map((w) => {
                const active = me === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => choose(w)}
                    className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-medium tracking-tight transition-colors ${
                      active ? 'bg-night-950 text-cream-50' : 'bg-night-950/5 text-night-950'
                    }`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PEOPLE[w].color! }} />
                    {PEOPLE[w].label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              {status === null ? (
                <div className="h-14" />
              ) : status === 'needs-install' ? (
                <div className="rounded-2xl bg-night-950/5 p-4 text-[13.5px] leading-relaxed text-night-950/75">
                  <p className="font-medium text-night-950">Add to Home Screen first</p>
                  <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
                    <li>Open this page in Safari</li>
                    <li>
                      Tap <span className="font-medium">Share</span> → <span className="font-medium">Add to Home Screen</span>
                    </li>
                    <li>Open Our Little World from your Home Screen and come back here</li>
                  </ol>
                </div>
              ) : status === 'unsupported' ? (
                <p className="rounded-2xl bg-night-950/5 p-4 text-[13.5px] text-night-950/70">
                  This browser doesn&apos;t support notifications.
                </p>
              ) : status === 'denied' ? (
                <p className="rounded-2xl bg-night-950/5 p-4 text-[13.5px] leading-relaxed text-night-950/70">
                  Notifications are blocked. Turn them on in <span className="font-medium">Settings → Notifications → Our Little World</span>.
                </p>
              ) : status === 'on' ? (
                <div className="flex items-center justify-between rounded-2xl bg-night-950/5 py-3 pl-4 pr-2">
                  <span className="flex items-center gap-2 text-[14.5px] font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Notifications are on
                  </span>
                  <button
                    type="button"
                    onClick={turnOff}
                    disabled={busy}
                    className="rounded-full px-3 py-1.5 text-[13px] font-medium text-night-950/55 active:bg-night-950/5"
                  >
                    Turn off
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={turnOn}
                  disabled={!me || busy}
                  className="h-14 w-full rounded-2xl bg-night-950 text-[15px] font-medium tracking-tight text-cream-50 transition-opacity disabled:opacity-35"
                >
                  {busy ? 'Turning on…' : me ? 'Turn on notifications' : 'Choose who you are first'}
                </button>
              )}
              {error && <p className="mt-2 text-center text-[12.5px] text-rose-600">{error}</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
