-- Fix: correct iNaturalist place ID for Orange County, CA.
-- 1126 was wrong (it is "Noble" county, Indiana).
-- 2738 is the verified iNaturalist place for Orange County, CA
-- (bbox: lat 33.334–33.948, lng -118.126–-117.413).
UPDATE regions SET inat_place_id = 2738 WHERE code = 'US-CA-059';
