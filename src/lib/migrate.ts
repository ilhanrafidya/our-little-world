import { getSql } from './db';

/**
 * Migrasi otomatis (idempoten): dijalankan sekali per instance server sebelum query pertama.
 * Aman diulang — tidak mengubah data yang sudah ada.
 *
 * v2: kolom `who` (together | ilhan | nadya) untuk kenangan sendiri.
 */
let ready: Promise<void> | null = null;

async function migrate() {
  const sql = getSql();
  await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS who TEXT NOT NULL DEFAULT 'together'`;
  await sql`
    DO $$ BEGIN
      ALTER TABLE memories ADD CONSTRAINT memories_who_check CHECK (who IN ('together', 'ilhan', 'nadya'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `;
  // v3: siapa yang menambahkan (untuk notifikasi) + langganan push
  await sql`ALTER TABLE memories ADD COLUMN IF NOT EXISTS added_by TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      who TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Kolom baru di view harus ditambahkan di akhir (aturan CREATE OR REPLACE VIEW)
  await sql`
    CREATE OR REPLACE VIEW memories_api AS
    SELECT
      id, title, city, city_key, country, lat, lng,
      status::text AS status,
      to_char(memory_date, 'YYYY-MM-DD') AS memory_date,
      story, spotify_url, photo_url, photo_pathname, photo_width, photo_height,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
      who,
      added_by
    FROM memories
  `;
}

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = migrate().catch((err) => {
      ready = null; // coba lagi di request berikutnya
      throw err;
    });
  }
  return ready;
}
