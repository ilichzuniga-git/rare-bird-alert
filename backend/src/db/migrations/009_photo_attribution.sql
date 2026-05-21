-- Add attribution text for iNaturalist photos
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS photo_attribution TEXT;
