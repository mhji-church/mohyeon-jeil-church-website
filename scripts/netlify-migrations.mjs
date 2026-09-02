import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDirectory = path.resolve("migrations/netlify");

export async function applyNetlifyMigrations(client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  const appliedResult = await client.execute(
    "SELECT version, checksum FROM schema_migrations ORDER BY version",
  );
  const applied = new Map(
    appliedResult.rows.map((row) => [String(row.version), String(row.checksum)]),
  );

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        throw new Error(`Applied migration checksum mismatch: ${file}`);
      }
      continue;
    }

    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => ({ sql: statement, args: [] }));
    statements.push({
      sql: "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
      args: [file, checksum],
    });
    await client.batch(statements, "write");
  }

  return files;
}
