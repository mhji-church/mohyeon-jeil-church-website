import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("..", import.meta.url));
const migration = fs.readFileSync(new URL("../drizzle/0007_archive_song_catalog.sql", import.meta.url), "utf8");
const statements = migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);

test("찬양 카탈로그 마이그레이션과 기존 데이터 백필은 비파괴적이고 멱등적이다", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mhji-song-migration-"));
  const databasePath = path.join(directory, "migration.sqlite");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  let db = createClient({ url: databaseUrl, authToken: "local-test-token" });
  try {
    await db.execute("CREATE TABLE archive_videos (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL)");
    await db.execute("CREATE TABLE archive_analysis_songs (id TEXT PRIMARY KEY NOT NULL, video_id TEXT NOT NULL, sort_order INTEGER NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL)");
    for (let repeat = 0; repeat < 2; repeat += 1) for (const statement of statements) await db.execute(statement);
    await db.execute({ sql: "INSERT INTO archive_videos (id, type) VALUES (?, ?)", args: ["legacy-video", "worship"] });
    for (const [id, order, title] of [["legacy-1", 1, "부흥(이 땅의 황무함을 보소서)"], ["legacy-2", 2, "부흥"], ["legacy-3", 3, "이 땅의 황무함을 보소서"]]) {
      await db.execute({ sql: "INSERT INTO archive_analysis_songs (id, video_id, sort_order, title, category) VALUES (?, ?, ?, ?, 'opening')", args: [id, "legacy-video", order, title] });
    }
  } finally { db.close(); }

  for (let repeat = 0; repeat < 2; repeat += 1) {
    const result = spawnSync(process.execPath, [path.join(repository, "scripts", "backfill-archive-songs.mjs")], {
      cwd: repository,
      env: { ...process.env, TURSO_DATABASE_URL: databaseUrl, TURSO_AUTH_TOKEN: "local-test-token" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }

  db = createClient({ url: databaseUrl, authToken: "local-test-token" });
  try {
    const [masters, aliases, links, legacy] = await Promise.all([
      db.execute("SELECT COUNT(*) AS count FROM archive_songs"),
      db.execute("SELECT COUNT(*) AS count FROM archive_song_names"),
      db.execute("SELECT COUNT(*) AS count FROM archive_video_songs"),
      db.execute("SELECT COUNT(*) AS count FROM archive_analysis_songs"),
    ]);
    assert.equal(Number(masters.rows[0].count), 1);
    assert.equal(Number(aliases.rows[0].count), 1);
    assert.equal(Number(links.rows[0].count), 1);
    assert.equal(Number(legacy.rows[0].count), 3);
  } finally {
    db.close();
    try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (error) { if (error?.code !== "EPERM") throw error; }
  }
});
