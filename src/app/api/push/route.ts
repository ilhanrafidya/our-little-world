import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth-guard';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { removeSubscription, saveSubscription, vapidPublicKey } from '@/lib/push';

const subscribeSchema = z.object({
  who: z.enum(['ilhan', 'nadya']),
  subscription: z.object({
    endpoint: z.url().max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
  }),
});

/** GET /api/push → kunci publik VAPID untuk berlangganan */
export async function GET() {
  const denied = await requireApiSession();
  if (denied) return denied;
  const key = vapidPublicKey();
  if (!key) return jsonError(503, 'Notifications are not set up yet.');
  return jsonOk({ publicKey: key });
}

/** POST /api/push → simpan langganan HP ini */
export async function POST(request: NextRequest) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const parsed = subscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(422, 'Invalid subscription.');
  try {
    await saveSubscription(parsed.data.subscription, parsed.data.who);
    return jsonOk({ ok: true });
  } catch (err) {
    console.error('[push:subscribe]', err);
    return jsonError(500, 'Could not turn on notifications.');
  }
}

/** DELETE /api/push → berhenti berlangganan */
export async function DELETE(request: NextRequest) {
  const denied = await requireApiSession();
  if (denied) return denied;
  const body = z.object({ endpoint: z.url().max(1000) }).safeParse(await readJson(request));
  if (!body.success) return jsonError(422, 'Invalid request.');
  try {
    await removeSubscription(body.data.endpoint);
    return jsonOk({ ok: true });
  } catch (err) {
    console.error('[push:unsubscribe]', err);
    return jsonError(500, 'Could not turn off notifications.');
  }
}
