'use client';

/** Identitas HP ini + push notification di sisi browser. */
export type Me = 'ilhan' | 'nadya';
const ME_KEY = 'olw-me';

export function getMe(): Me | null {
  try {
    const v = localStorage.getItem(ME_KEY);
    return v === 'ilhan' || v === 'nadya' ? v : null;
  } catch {
    return null;
  }
}

export function setMe(me: Me) {
  try {
    localStorage.setItem(ME_KEY, me);
  } catch {}
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export type PushStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function pushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function keyToBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(me: Me): Promise<PushStatus> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = (await registerSW()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  const res = await fetch('/api/push');
  if (!res.ok) throw new Error('Notifications are not set up yet.');
  const { publicKey } = (await res.json()) as { publicKey: string };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  const save = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ who: me, subscription: sub.toJSON() }),
  });
  if (!save.ok) throw new Error('Could not turn on notifications.');
  return 'on';
}

export async function disablePush(): Promise<PushStatus> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch('/api/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return 'off';
}
