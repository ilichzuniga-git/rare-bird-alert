-- Add iNaturalist place ID to regions.
-- iNaturalist uses its own numeric place IDs (different from eBird region codes).
-- To find the right ID for a region, visit:
--   https://www.inaturalist.org/places and search for the county name,
--   then note the numeric ID in the URL, e.g. /places/962 → 962.
--
-- Known US county place IDs (verified via iNaturalist place pages):
--   Los Angeles County, CA  → 962
--   Orange County, CA       → 1126

ALTER TABLE regions ADD COLUMN IF NOT EXISTS inat_place_id INTEGER;

UPDATE regions SET inat_place_id = 962  WHERE code = 'US-CA-037'; -- LA County
UPDATE regions SET inat_place_id = 2738 WHERE code = 'US-CA-059'; -- Orange County
