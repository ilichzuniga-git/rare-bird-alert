-- FK linking each sighting to its cluster (null = not yet clustered or no coords)
ALTER TABLE sightings ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);
CREATE INDEX IF NOT EXISTS sightings_cluster_id_idx ON sightings (cluster_id);
