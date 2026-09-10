CREATE TABLE IF NOT EXISTS member_merge_groups (
  id TEXT PRIMARY KEY NOT NULL,
  representative_member_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'reverted')),
  resolved_profile_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reverted_by TEXT,
  reverted_at TEXT
);

CREATE TABLE IF NOT EXISTS member_merge_accounts (
  merge_id TEXT NOT NULL,
  member_id TEXT NOT NULL UNIQUE,
  is_representative INTEGER NOT NULL DEFAULT 0,
  original_member_json TEXT NOT NULL,
  original_access_json TEXT NOT NULL DEFAULT '[]',
  related_record_counts_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(merge_id, member_id),
  FOREIGN KEY(merge_id) REFERENCES member_merge_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS member_login_aliases (
  username TEXT PRIMARY KEY NOT NULL,
  source_member_id TEXT NOT NULL UNIQUE,
  representative_member_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_member_id) REFERENCES members(id) ON DELETE RESTRICT,
  FOREIGN KEY(representative_member_id) REFERENCES members(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS member_auth_state (
  member_id TEXT PRIMARY KEY NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS member_merge_groups_representative_idx ON member_merge_groups(representative_member_id, status);
CREATE INDEX IF NOT EXISTS member_merge_accounts_merge_idx ON member_merge_accounts(merge_id);
CREATE INDEX IF NOT EXISTS member_login_aliases_representative_idx ON member_login_aliases(representative_member_id, enabled);
