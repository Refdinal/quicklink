-- Jalankan sekali di database Neon (via SQL editor atau `npm run db:init`).

CREATE TABLE IF NOT EXISTS links (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS links_created_at_idx ON links (created_at DESC);
