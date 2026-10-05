-- App-icon badge: how many alerts a device has had since its app was last opened.
-- badges: the installed build clears the badge when opened (1.5.0+), so counts may be sent to it;
-- older builds never would, and a count on their icon would only keep growing.
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS badges BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS unread INTEGER NOT NULL DEFAULT 0;
