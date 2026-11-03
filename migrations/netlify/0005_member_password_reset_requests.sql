CREATE TABLE IF NOT EXISTS member_password_reset_requests (
  member_id TEXT PRIMARY KEY NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);
