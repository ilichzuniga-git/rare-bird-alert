-- BirdWeather corroboration: a small set of "this BirdWeather station near the
-- rare-bird cluster also heard that species on a day the cluster was reported".
-- Used only as supportive context on the cluster detail view; never creates
-- sightings, alerts, notifications, or changes cluster status.
CREATE TABLE IF NOT EXISTS birdweather_matches (
  id               SERIAL PRIMARY KEY,
  cluster_id       INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  station_id       TEXT NOT NULL,
  station_name     TEXT NOT NULL,
  species_name     TEXT NOT NULL,          -- BirdWeather common name
  detected_on      DATE NOT NULL,          -- Pacific date
  detection_count  INTEGER NOT NULL,       -- detections at this station that day (>= 2)
  max_confidence   DOUBLE PRECISION NOT NULL,
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cluster_id, station_id, detected_on)
);
CREATE INDEX IF NOT EXISTS birdweather_matches_cluster_id_idx ON birdweather_matches (cluster_id);
