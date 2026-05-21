-- Add rarity_count to sightings.
-- NULL  = source does its own rarity filtering (eBird notable)
-- number = all-time research-grade observation count for this species in the
--          region (iNaturalist). Lower = rarer.
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS rarity_count INTEGER;
