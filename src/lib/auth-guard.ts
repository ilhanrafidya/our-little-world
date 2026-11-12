import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from './session';
import { jsonError } from './http';

export async function hasValidSession(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Untuk route handler API. Pola pakai:
 *   const denied = await requireApiSession();
 *   if (denied) return denied;
 */
export async function requireApiSession() {
  if (await hasValidSession()) return null;
  return jsonError(401, 'Session expired. Please unlock again.');
}

/** Untuk Server Component halaman (lapisan kedua setelah proxy.ts). */
export async function requirePageSession(nextPath = '/') {
  if (!(await hasValidSession())) {
    redirect(`/unlock?next=${encodeURIComponent(nextPath)}`);
  }
}
