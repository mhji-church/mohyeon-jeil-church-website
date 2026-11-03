CREATE TABLE IF NOT EXISTS member_recovery_grants (
  token_hash TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL UNIQUE,
  session_version INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);
