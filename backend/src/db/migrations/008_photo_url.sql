-- Add photo_url to sightings.
-- Populated for iNaturalist sightings from taxon.default_photo.square_url.
-- NULL for eBird sightings (the mobile app lazy-loads these via iNaturalist taxa API).
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS photo_url TEXT;
