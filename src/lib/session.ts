/**
 * Session berbasis cookie bertanda tangan HMAC-SHA256 (Web Crypto).
 * Format token:  base64url(JSON payload) + "." + base64url(signature)
 *
 * - Passcode TIDAK pernah disimpan di cookie.
 * - Kunci HMAC = SESSION_SECRET + APP_PASSCODE → kalau passcode diganti,
 *   semua sesi lama otomatis tidak valid (semua device harus unlock ulang).
 * - Berjalan di runtime Node.js (route handler & proxy.ts Next.js 16).
 */

export const SESSION_COOKIE = 'olw_session';

const enc = new TextEncoder();
const dec = new TextDecoder();

interface SessionPayload {
  v: 1;
  iat: number; // detik
  exp: number; // detik
}

// ── base64url helpers ──────────────────────────────────────────
function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── config ─────────────────────────────────────────────────────
export function sessionMaxAgeSeconds(): number {
  const days = Number(process.env.SESSION_MAX_AGE_DAYS ?? '30');
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
  return Math.round(safeDays * 24 * 60 * 60);
}

export function sessionCookieOptions(maxAge = sessionMaxAgeSeconds()) {
  return {
    httpOnly: true,
    // `secure` dimatikan di dev agar bisa dites dari HP via http://IP-LAPTOP:3000
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

let keyCache: { material: string; key: Promise<CryptoKey> } | null = null;

function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET ?? '';
  const passcode = process.env.APP_PASSCODE ?? '';
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET minimal 32 karakter. Buat dengan `npm run gen:secret`.');
  }
  if (passcode.length < 4) {
    throw new Error('APP_PASSCODE belum diset (minimal 4 karakter).');
  }
  const material = `${secret}::${passcode}`;
  if (keyCache?.material !== material) {
    keyCache = {
      material,
      key: crypto.subtle.importKey('raw', enc.encode(material), { name: 'HMAC', hash: 'SHA-256' }, false, [
        'sign',
        'verify',
      ]),
    };
  }
  return keyCache.key;
}

// ── token ──────────────────────────────────────────────────────
export async function createSessionToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { v: 1, iat: now, exp: now + sessionMaxAgeSeconds() };
  const body = toB64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await getKey(), enc.encode(body));
  return `${body}.${toB64url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string | null | undefined): Promise<boolean> {
  if (!token || token.length > 512) return false;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return false;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    // crypto.subtle.verify membandingkan signature secara constant-time
    const valid = await crypto.subtle.verify('HMAC', await getKey(), fromB64url(sig), enc.encode(body));
    if (!valid) return false;

    const payload = JSON.parse(dec.decode(fromB64url(body))) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1000);
    return payload.v === 1 && typeof payload.exp === 'number' && payload.exp > now;
  } catch {
    return false;
  }
}

// ── passcode ───────────────────────────────────────────────────
async function sha256(input: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

/** Perbandingan timing-safe: kedua sisi di-hash dulu agar panjangnya selalu sama. */
export async function passcodeMatches(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256(input.normalize('NFC')), sha256(expected.normalize('NFC'))]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
