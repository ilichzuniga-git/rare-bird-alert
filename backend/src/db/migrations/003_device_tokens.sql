-- Device push tokens for Expo push notifications
CREATE TABLE device_tokens (
  id          SERIAL PRIMARY KEY,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT,                       -- 'ios' | 'android'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);
