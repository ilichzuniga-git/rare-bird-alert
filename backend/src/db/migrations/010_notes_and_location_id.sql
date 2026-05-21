-- Observer notes from eBird (obs.comments) and iNaturalist (obs.description)
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS notes TEXT;

-- eBird location ID (e.g. 'L123456') used to link to the hotspot page
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS location_id TEXT;
