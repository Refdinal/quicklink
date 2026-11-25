-- Jalankan sekali di database Neon (via SQL editor atau `npm run db:init`).

CREATE TABLE IF NOT EXISTS meetings (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'rapat',
  location    TEXT,
  link        TEXT,
  start_at    TIMESTAMP NOT NULL,
  end_at      TIMESTAMP NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_start_at_idx ON meetings (start_at);
