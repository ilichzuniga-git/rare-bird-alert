-- Clusters represent a continuing individual bird: same species, same location (≤250m), rolling window
CREATE TABLE IF NOT EXISTS clusters (
  id                SERIAL PRIMARY KEY,
  species_key       TEXT NOT NULL,         -- scientific_name (or common_name if null)
  common_name       TEXT NOT NULL,
  center_lat        DOUBLE PRECISION NOT NULL,
  center_lng        DOUBLE PRECISION NOT NULL,
  radius_m          INTEGER NOT NULL DEFAULT 250,
  first_seen        TIMESTAMPTZ NOT NULL,
  last_seen         TIMESTAMPTZ NOT NULL,  -- most recent sighting (any source)
  sighting_count    INTEGER NOT NULL DEFAULT 1,
  checklist_count   INTEGER NOT NULL DEFAULT 1, -- distinct source_ids = distinct observer events
  last_refound_at   TIMESTAMPTZ,           -- most recent user "refound" report
  last_dipped_at    TIMESTAMPTZ,           -- most recent user "dipped" report
  refound_count     INTEGER NOT NULL DEFAULT 0,
  dip_count         INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clusters_species_key_idx ON clusters (species_key);
CREATE INDEX IF NOT EXISTS clusters_last_seen_idx   ON clusters (last_seen DESC);
