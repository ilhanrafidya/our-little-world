import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSessionToken, passcodeMatches, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { checkLock, registerFail, registerSuccess } from '@/lib/rate-limit';
import { clientIp, jsonError, readJson } from '@/lib/http';

const bodySchema = z.object({ passcode: z.string().min(1).max(200) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const lock = checkLock(ip);
  if (lock.locked) {
    return jsonError(429, `Terlalu banyak percobaan. Coba lagi dalam ${lock.retryAfter} detik.`, undefined, {
      'Retry-After': String(lock.retryAfter),
    });
  }

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError(400, 'Passcode wajib diisi.');

  let ok: boolean;
  try {
    ok = await passcodeMatches(parsed.data.passcode);
  } catch (err) {
    console.error('[auth] konfigurasi passcode bermasalah', err);
    return jsonError(500, 'Server belum dikonfigurasi (APP_PASSCODE / SESSION_SECRET).');
  }

  if (!ok) {
    const retryAfter = registerFail(ip);
    await sleep(600); // perlambat brute force
    return retryAfter > 0
      ? jsonError(429, `Kode salah. Tunggu ${retryAfter} detik sebelum mencoba lagi.`, undefined, {
          'Retry-After': String(retryAfter),
        })
      : jsonError(401, 'Kode salah, coba lagi ya.');
  }

  registerSuccess(ip);

  try {
    const token = await createSessionToken();
    const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error('[auth] gagal membuat sesi', err);
    return jsonError(500, 'Server belum dikonfigurasi (SESSION_SECRET).');
  }
}
