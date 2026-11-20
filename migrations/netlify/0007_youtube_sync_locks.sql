CREATE TABLE IF NOT EXISTS youtube_sync_locks (
  playlist_type TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  lease_until INTEGER NOT NULL,
  next_allowed_at INTEGER NOT NULL
);
