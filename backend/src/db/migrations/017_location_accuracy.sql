-- iNaturalist public_positional_accuracy (metres) for this sighting.
-- NULL for unknown sources (eBird) and for older iNaturalist rows.
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS location_accuracy_m INTEGER;          -- iNaturalist public accuracy; NULL = unknown

-- iNaturalist hides the true location when this is true (observer geoprivacy or
-- a sensitive species); the public lat/lng is then a randomised point.
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS location_obscured BOOLEAN NOT NULL DEFAULT false;
