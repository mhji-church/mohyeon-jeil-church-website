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

export class PreparedStatement {
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
    // Writes deliberately have no automatic retry: callers must know whether a
    // mutation committed before deciding how to recover.
    return this.client.batch(statements.map((statement) => statement.toStatement()), "write");
  }
}

let database: NetlifyDatabase | null = null;

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
  // Kept as a compatibility boundary for existing callers. Migrations and
  // seeds are deploy/CLI-only; request handlers never execute schema writes.
  getNetlifyDb();
}
