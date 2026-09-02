import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { applyNetlifyMigrations } from "./netlify-migrations.mjs";

async function withTemporaryDatabase(name, setup) {
  const directory = await mkdtemp(path.join(os.tmpdir(), `mhji-${name}-`));
  const client = createClient({ url: pathToFileURL(path.join(directory, "test.sqlite")).href });
  try {
    await setup(client);
    await applyNetlifyMigrations(client);
    await applyNetlifyMigrations(client);
    const tables = await client.execute(
      "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name",
    );
    const names = new Set(tables.rows.map((row) => String(row.name)));
    for (const required of ["content_posts", "members", "archive_videos", "admin_audit_logs", "schema_migrations"]) {
      if (!names.has(required)) throw new Error(`${name}: missing table ${required}`);
    }
  } finally {
    await client.close();
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

await withTemporaryDatabase("new", async () => {});
await withTemporaryDatabase("existing", async (client) => {
  await client.execute("CREATE TABLE content_posts (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, date TEXT NOT NULL, excerpt TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', images TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'published', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  await client.execute({
    sql: "INSERT INTO content_posts (id, type, title, date) VALUES (?, ?, ?, ?)",
    args: ["existing-row", "news", "preserved", "2026.01.01"],
  });
});

console.log("Netlify migrations passed for new and existing-schema temporary databases.");
