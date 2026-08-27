import { createClient, type Client, type InStatement } from "@libsql/client";

type BoundValue = string | number | bigint | null | Uint8Array;

const transientReadErrorCodes = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const readRetryDelayMs = 150;

function isReadStatement(sql: string) {
  return /^(?:SELECT|PRAGMA|EXPLAIN)\b/i.test(sql.trimStart());
}

function isTransientReadError(error: unknown) {
  let current: unknown = error;
  const seen = new Set<unknown>();
  for (let depth = 0; current && depth < 6 && !seen.has(current); depth += 1) {
    seen.add(current);
    if (typeof current === "object") {
      const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
      if (typeof candidate.code === "string" && transientReadErrorCodes.has(candidate.code)) {
        return true;
      }
      if (
        typeof candidate.message === "string" &&
        /(?:read ECONNRESET|socket hang up|other side closed|connection reset)/i.test(candidate.message)
      ) {
        return true;
      }
      current = candidate.cause;
      continue;
    }
    break;
  }
  return false;
}

async function executeRead(
  client: Client,
  statement: { sql: string; args: BoundValue[] },
) {
  try {
    return await client.execute(statement);
  } catch (error) {
    if (!isReadStatement(statement.sql) || !isTransientReadError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, readRetryDelayMs));
    return client.execute(statement);
  }
}

class PreparedStatement {
  constructor(
    private readonly client: Client,
    readonly sql: string,
    readonly args: BoundValue[] = [],
  ) {}

  bind(...args: BoundValue[]) {
    return new PreparedStatement(this.client, this.sql, args);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await executeRead(this.client, { sql: this.sql, args: this.args });
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>() {
    const result = await executeRead(this.client, { sql: this.sql, args: this.args });
    return { results: result.rows as unknown as T[] };
  }

  async run() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return { success: true, meta: { changes: result.rowsAffected } };
  }

  toStatement(): InStatement {
    return { sql: this.sql, args: this.args };
  }
}

class NetlifyDatabase {
  constructor(private readonly client: Client) {}

  prepare(sql: string) {
    return new PreparedStatement(this.client, sql);
  }

  async batch(statements: PreparedStatement[]) {
    return this.client.batch(statements.map((statement) => statement.toStatement()), "write");
  }
}

let database: NetlifyDatabase | null = null;
let schemaReady: Promise<void> | null = null;

function required(name: "TURSO_DATABASE_URL" | "TURSO_AUTH_TOKEN") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Netlify environment variable ${name} is missing.`);
  return value;
}

export function getNetlifyDb() {
  if (!database) {
    database = new NetlifyDatabase(
      createClient({
        url: required("TURSO_DATABASE_URL"),
        authToken: required("TURSO_AUTH_TOKEN"),
      }),
    );
  }
  return database;
}

export async function ensureNetlifySchema() {
  if (!schemaReady) {
    const db = getNetlifyDb();
    schemaReady = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS content_posts (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, date TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', images TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'published', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, birth_date TEXT NOT NULL DEFAULT '', position TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', force_password_change INTEGER NOT NULL DEFAULT 0, approved_at TEXT, approved_by TEXT, last_login_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE UNIQUE INDEX IF NOT EXISTS members_username_unique ON members(username)`,
        `CREATE TABLE IF NOT EXISTS business_applications (id TEXT PRIMARY KEY NOT NULL, member_id TEXT NOT NULL, applicant_name TEXT NOT NULL, applicant_phone TEXT NOT NULL, business_name TEXT NOT NULL, category TEXT NOT NULL, owner_name TEXT NOT NULL, business_phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL, description TEXT NOT NULL, website TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS youtube_playlist_cache (playlist_type TEXT PRIMARY KEY NOT NULL, videos_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE IF NOT EXISTS archive_videos (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL CHECK(type IN ('worship', 'attendance')), date TEXT NOT NULL, service_type TEXT NOT NULL, title TEXT NOT NULL, preacher TEXT NOT NULL DEFAULT '', youtube_id TEXT NOT NULL UNIQUE, youtube_url TEXT NOT NULL, thumbnail_url TEXT NOT NULL DEFAULT '', duration_seconds INTEGER, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE INDEX IF NOT EXISTS archive_videos_date_idx ON archive_videos(date DESC)`,
        `CREATE INDEX IF NOT EXISTS archive_videos_type_service_idx ON archive_videos(type, service_type)`,
        `CREATE TABLE IF NOT EXISTS member_app_access (member_id TEXT NOT NULL, app_code TEXT NOT NULL, access_level TEXT NOT NULL DEFAULT 'none' CHECK(access_level IN ('none', 'worship', 'full')), granted_by TEXT, granted_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(member_id, app_code))`,
        `CREATE INDEX IF NOT EXISTS member_app_access_level_idx ON member_app_access(app_code, access_level)`,
        `CREATE TABLE IF NOT EXISTS archive_audit_logs (id TEXT PRIMARY KEY NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE INDEX IF NOT EXISTS archive_audit_logs_created_idx ON archive_audit_logs(created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS archive_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      ];
      for (const sql of statements) await db.prepare(sql).run();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}
