-- Regions: each row is a pollable region (eBird region code + display name)
CREATE TABLE regions (
  id         SERIAL PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,   -- e.g. 'US-CA-037' (LA County)
  name       TEXT NOT NULL,          -- e.g. 'Los Angeles County'
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed LA and Orange Counties
INSERT INTO regions (code, name) VALUES
  ('US-CA-037', 'Los Angeles County'),
  ('US-CA-059', 'Orange County');
