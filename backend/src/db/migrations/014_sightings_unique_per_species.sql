-- eBird source_id is the checklist ID (subId), so two notable species on the
-- same checklist collided on UNIQUE (source, source_id) and only the first was
-- kept. Make uniqueness per species. iNaturalist has no species_code (its
-- source_id is already per-observation), hence the COALESCE so NULLs still
-- conflict instead of being treated as distinct.
ALTER TABLE sightings DROP CONSTRAINT IF EXISTS sightings_source_source_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS sightings_source_source_id_species_key
  ON sightings (source, source_id, COALESCE(species_code, ''));
