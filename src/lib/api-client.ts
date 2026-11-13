'use client';

import { upload } from '@vercel/blob/client';
import type { Memory, MemoryPhoto, MemoryStatus, MemoryWho } from '@/types/memory';
import { compressImage } from './image-compress';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: FieldError[] = [],
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new ApiError('No internet connection. Try again.', 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; details?: FieldError[] } & T;
  if (res.status === 401) {
    window.location.href = '/unlock';
    throw new ApiError('Session expired. Please unlock again.', 401);
  }
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong.', res.status, data.details ?? []);
  return data;
}

export interface MemoryPayload {
  title: string;
  city: string;
  country: string | null;
  lat: number;
  lng: number;
  status: MemoryStatus;
  who: MemoryWho;
  memoryDate: string | null;
  story: string | null;
  spotifyUrl: string | null;
  photo?: MemoryPhoto | null;
}

export async function apiCreateMemory(payload: MemoryPayload): Promise<Memory> {
  const { getMe } = await import('./notify-client');
  const { memory } = await request<{ memory: Memory }>('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ ...payload, addedBy: getMe() }),
  });
  const { markSeen } = await import('./seen');
  markSeen(memory.createdAt);
  return memory;
}

export async function apiUpdateMemory(id: string, payload: Partial<MemoryPayload>): Promise<Memory> {
  const { memory } = await request<{ memory: Memory }>(`/api/memories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return memory;
}

export async function apiDeleteMemory(id: string): Promise<void> {
  await request(`/api/memories/${id}`, { method: 'DELETE' });
}

function randomId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Kompres di HP → upload langsung ke Vercel Blob → kembalikan data foto untuk disimpan. */
export async function uploadPhoto(file: File, onStage?: (stage: 'compress' | 'upload') => void): Promise<MemoryPhoto> {
  onStage?.('compress');
  const img = await compressImage(file);
  onStage?.('upload');
  try {
    const blob = await upload(`memories/${randomId()}.${img.ext}`, img.blob, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      contentType: img.type,
    });
    return { url: blob.url, pathname: blob.pathname, width: img.width, height: img.height };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    throw new ApiError(
      /401|session/i.test(msg) ? 'Session expired. Please unlock again.' : 'Photo upload failed. Check your connection and try again.',
      0,
    );
  }
}
