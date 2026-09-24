-- eBird's obsDt is the observer's local (Pacific) time with no zone, but it was
-- parsed on a UTC server, so every eBird observed_at is 7-8 hours too early
-- (e.g. a 3:37 PM sighting stored as 15:37 UTC = 8:37 AM Pacific). That inflated
-- every "seen Xh ago" and cluster status by the same amount.
--
-- Reinterpret the stored wall-clock time as Pacific: take the UTC wall clock
-- (15:37) and read it in America/Los_Angeles (→ 22:37 UTC). New rows are parsed
-- correctly by the poller from now on.
UPDATE sightings
SET observed_at = (observed_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Los_Angeles'
WHERE source = 'ebird';

-- Cluster first/last seen are derived from their sightings; bring them in line.
UPDATE clusters c
SET first_seen = s.first_seen,
    last_seen  = s.last_seen,
    updated_at = NOW()
FROM (
  SELECT cluster_id, MIN(observed_at) AS first_seen, MAX(observed_at) AS last_seen
  FROM sightings
  WHERE cluster_id IS NOT NULL
  GROUP BY cluster_id
) s
WHERE c.id = s.cluster_id;
