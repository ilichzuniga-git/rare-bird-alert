-- Refound / dipped reports no longer keep where the reporter was, or a device id.
-- Nothing ever read these columns; dropping them also deletes what earlier reports stored.
ALTER TABLE cluster_reports DROP COLUMN IF EXISTS lat;
ALTER TABLE cluster_reports DROP COLUMN IF EXISTS lng;
ALTER TABLE cluster_reports DROP COLUMN IF EXISTS device_id;
