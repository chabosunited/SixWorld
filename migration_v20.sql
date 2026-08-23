-- SIXWORLD v20 media view persistence
ALTER TABLE media_views ADD COLUMN external_views INTEGER NOT NULL DEFAULT 0;
