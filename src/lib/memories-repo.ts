import { getSql } from './db';
import type { Memory, MemoryStatus } from '@/types/memory';
import type { CreateMemoryInput, UpdateMemoryInput } from './validation';

type Row = Record<string, unknown>;

function toMemory(r: Row): Memory {
  const photoUrl = r.photo_url as string | null;
  return {
    id: r.id as string,
    title: r.title as string,
    city: r.city as string,
    cityKey: r.city_key as string,
    country: (r.country as string | null) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    status: r.status as MemoryStatus,
    memoryDate: (r.memory_date as string | null) ?? null,
    story: (r.story as string | null) ?? null,
    spotifyUrl: (r.spotify_url as string | null) ?? null,
    photo: photoUrl
      ? {
          url: photoUrl,
          pathname: (r.photo_pathname as string) ?? '',
          width: Number(r.photo_width ?? 0),
          height: Number(r.photo_height ?? 0),
        }
      : null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** Urut kronologis: dipakai Globe untuk flight arcs & Play Journey. */
export async function listMemories(): Promise<Memory[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM memories_api
    ORDER BY memory_date ASC NULLS LAST, created_at ASC
  `;
  return rows.map(toMemory);
}

export async function getMemory(id: string): Promise<Memory | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM memories_api WHERE id = ${id} LIMIT 1`;
  return rows[0] ? toMemory(rows[0]) : null;
}

export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  const sql = getSql();
  const p = input.photo ?? null;
  const rows = await sql`
    INSERT INTO memories (
      title, city, country, lat, lng, status, memory_date, story, spotify_url,
      photo_url, photo_pathname, photo_width, photo_height
    ) VALUES (
      ${input.title}, ${input.city}, ${input.country ?? null}, ${input.lat}, ${input.lng},
      ${input.status}, ${input.memoryDate ?? null}, ${input.story ?? null}, ${input.spotifyUrl ?? null},
      ${p?.url ?? null}, ${p?.pathname ?? null}, ${p?.width ?? null}, ${p?.height ?? null}
    )
    RETURNING id
  `;
  const created = await getMemory(rows[0]!.id as string);
  if (!created) throw new Error('Gagal membaca data yang baru dibuat');
  return created;
}

/**
 * PATCH semantics: field `undefined` = tidak diubah, `null` = dikosongkan.
 * Mengembalikan URL foto lama jika foto diganti/dihapus (untuk dibersihkan dari Blob).
 */
export async function updateMemory(
  id: string,
  patch: UpdateMemoryInput,
): Promise<{ memory: Memory; oldPhotoUrl: string | null } | null> {
  const existing = await getMemory(id);
  if (!existing) return null;

  const pick = <K extends keyof UpdateMemoryInput>(key: K, current: unknown) =>
    patch[key] === undefined ? current : patch[key];

  const photo = patch.photo === undefined ? existing.photo : patch.photo;
  const photoChanged = patch.photo !== undefined && patch.photo?.url !== existing.photo?.url;

  const sql = getSql();
  await sql`
    UPDATE memories SET
      title          = ${pick('title', existing.title) as string},
      city           = ${pick('city', existing.city) as string},
      country        = ${pick('country', existing.country) as string | null},
      lat            = ${pick('lat', existing.lat) as number},
      lng            = ${pick('lng', existing.lng) as number},
      status         = ${pick('status', existing.status) as MemoryStatus},
      memory_date    = ${pick('memoryDate', existing.memoryDate) as string | null},
      story          = ${pick('story', existing.story) as string | null},
      spotify_url    = ${pick('spotifyUrl', existing.spotifyUrl) as string | null},
      photo_url      = ${photo?.url ?? null},
      photo_pathname = ${photo?.pathname ?? null},
      photo_width    = ${photo?.width ?? null},
      photo_height   = ${photo?.height ?? null}
    WHERE id = ${id}
  `;

  const memory = await getMemory(id);
  if (!memory) return null;
  return { memory, oldPhotoUrl: photoChanged ? (existing.photo?.url ?? null) : null };
}

export async function deleteMemory(id: string): Promise<{ photoUrl: string | null } | null> {
  const sql = getSql();
  const rows = await sql`DELETE FROM memories WHERE id = ${id} RETURNING photo_url`;
  if (!rows[0]) return null;
  return { photoUrl: (rows[0].photo_url as string | null) ?? null };
}
