-- User-submitted refound / dipped reports
CREATE TABLE IF NOT EXISTS cluster_reports (
  id          SERIAL PRIMARY KEY,
  cluster_id  INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('refound', 'dipped')),
  device_id   TEXT,                        -- anonymous device identifier
  lat         DOUBLE PRECISION,            -- where the user was when reporting
  lng         DOUBLE PRECISION,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cluster_reports_cluster_id_idx ON cluster_reports (cluster_id);
