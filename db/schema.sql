-- ═════════════════════════════════════════════════════════════
--  Our Little World — skema Neon Postgres
--  Jalankan SEKALI di Neon Console → SQL Editor (aman dijalankan ulang).
-- ═════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE memory_status AS ENUM ('visited', 'wishlist');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS memories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Info tempat
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  city            TEXT NOT NULL CHECK (char_length(city) BETWEEN 1 AND 80),
  city_key        TEXT GENERATED ALWAYS AS (lower(btrim(city))) STORED,
  country         TEXT CHECK (country IS NULL OR char_length(country) <= 80),

  -- Koordinat
  lat             DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng             DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),

  -- Kenangan
  status          memory_status NOT NULL DEFAULT 'visited',
  -- together = berdua; ilhan / nadya = kenangan saat sendiri (selalu visited)
  who             TEXT NOT NULL DEFAULT 'together' CHECK (who IN ('together', 'ilhan', 'nadya')),
  memory_date     DATE,
  story           TEXT CHECK (story IS NULL OR char_length(story) <= 5000),
  spotify_url     TEXT,

  -- Foto (Vercel Blob) — satu foto per spot
  photo_url       TEXT,
  photo_pathname  TEXT,
  photo_width     INT CHECK (photo_width IS NULL OR photo_width > 0),
  photo_height    INT CHECK (photo_height IS NULL OR photo_height > 0),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memories_city_key ON memories (city_key);
CREATE INDEX IF NOT EXISTS idx_memories_status   ON memories (status);
CREATE INDEX IF NOT EXISTS idx_memories_date     ON memories (memory_date);

-- Auto-update kolom updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memories_updated_at ON memories;
CREATE TRIGGER trg_memories_updated_at
BEFORE UPDATE ON memories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- View untuk API: tanggal & timestamp sudah berupa string ISO
-- (menghindari konversi DATE → JS Date yang bisa bergeser zona waktu)
CREATE OR REPLACE VIEW memories_api AS
SELECT
  id,
  title,
  city,
  city_key,
  country,
  lat,
  lng,
  status::text                                  AS status,
  to_char(memory_date, 'YYYY-MM-DD')            AS memory_date,
  story,
  spotify_url,
  photo_url,
  photo_pathname,
  photo_width,
  photo_height,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
  who
FROM memories;
