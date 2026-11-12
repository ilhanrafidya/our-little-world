import { NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonError(status: number, error: string, details?: unknown, headers?: Record<string, string>) {
  return NextResponse.json(details === undefined ? { error } : { error, details }, {
    status,
    headers: { ...NO_STORE, ...headers },
  });
}

/** Baca body JSON dengan aman; kembalikan `undefined` kalau body rusak. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'local';
}
