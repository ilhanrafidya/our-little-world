import webpush from 'web-push';
import { getSql } from './db';
import { ensureSchema } from './migrate';
import type { Memory } from '@/types/memory';

/**
 * Push notification (Web Push + VAPID, tanpa layanan berbayar).
 * Notifikasi dikirim ke HP pasangan, bukan ke yang menambahkan.
 */
const NAMES = { ilhan: 'Ilhan', nadya: 'Nadya' } as const;

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@example.com', pub, priv);
  configured = true;
  return true;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, who: 'ilhan' | 'nadya') {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (endpoint, who, p256dh, auth)
    VALUES (${sub.endpoint}, ${who}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET who = EXCLUDED.who, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;
}

export async function removeSubscription(endpoint: string) {
  await ensureSchema();
  await getSql()`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

export async function notifyNewMemory(memory: Memory) {
  try {
    if (!configure()) return;
    await ensureSchema();
    const sql = getSql();
    const rows = memory.addedBy
      ? await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE who <> ${memory.addedBy}`
      : await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`;
    if (rows.length === 0) return;

    const name = memory.addedBy ? NAMES[memory.addedBy] : null;
    const place = [memory.title, memory.city].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
    const title =
      memory.status === 'wishlist'
        ? `${name ?? 'Someone'} added a place to your wishlist ✨`
        : `${name ?? 'Someone'} pinned a new memory 📍`;
    const payload = JSON.stringify({ title, body: place, url: '/', tag: `memory-${memory.id}` });

    await Promise.allSettled(
      rows.map(async (r) => {
        try {
          await webpush.sendNotification(
            { endpoint: r.endpoint as string, keys: { p256dh: r.p256dh as string, auth: r.auth as string } },
            payload,
            { TTL: 60 * 60 * 24 },
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          // langganan sudah tidak berlaku (app dihapus / izin dicabut)
          if (code === 404 || code === 410) await removeSubscription(r.endpoint as string);
          else console.error('[push:send]', code, err);
        }
      }),
    );
  } catch (err) {
    console.error('[push:notify]', err);
  }
}
