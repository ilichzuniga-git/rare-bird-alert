-- Purge all iNaturalist sightings that were ingested while Orange County
-- had the wrong place_id (1126 = Noble County, Indiana instead of 2738 = Orange County, CA).
-- The next poll will repopulate with correct California data.
DELETE FROM sightings WHERE source = 'inaturalist';
