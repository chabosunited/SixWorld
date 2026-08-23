CREATE TABLE IF NOT EXISTS community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type TEXT NOT NULL CHECK(media_type IN ('video','screenshot')),
  content_id TEXT NOT NULL,
  parent_id INTEGER,
  nickname TEXT NOT NULL,
  body TEXT NOT NULL,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_media ON community_comments(media_type,content_id,created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON community_comments(parent_id);

CREATE TABLE IF NOT EXISTS media_views (
  media_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  external_views INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(media_type,content_id)
);
