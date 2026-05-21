-- Sightings: one row per unique observation from any source
CREATE TABLE sightings (
  id              SERIAL PRIMARY KEY,
  region_code     TEXT NOT NULL REFERENCES regions(code),
  source          TEXT NOT NULL,          -- e.g. 'ebird'
  source_id       TEXT NOT NULL,          -- source's unique ID for this obs
  species_code    TEXT,                   -- eBird species code
  common_name     TEXT NOT NULL,
  scientific_name TEXT,
  lat             NUMERIC(9,6),
  lng             NUMERIC(9,6),
  location_name   TEXT,
  observed_at     TIMESTAMPTZ NOT NULL,
  how_many        INTEGER,                -- null = presence only
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (source, source_id)              -- prevent duplicate inserts
);

CREATE INDEX sightings_region_observed
  ON sightings (region_code, observed_at DESC);
