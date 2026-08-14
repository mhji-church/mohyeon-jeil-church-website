import fs from "node:fs";
import path from "node:path";

const inputPath = path.resolve(process.argv.find((value) => !value.startsWith("--") && value.endsWith(".json")) || "data/archive-videos.seed.json");
const dryRun = process.argv.includes("--dry-run");
const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const videos = Array.isArray(payload?.videos) ? payload.videos : [];

function validate(video, index) {
  const label = `videos[${index}]`;
  if (!video || typeof video !== "object") throw new Error(`${label} must be an object`);
  if (!video.id || !video.title || !/^\d{4}-\d{2}-\d{2}$/.test(video.date || "")) throw new Error(`${label} has invalid required fields`);
  if (!["worship", "attendance"].includes(video.type)) throw new Error(`${label} has an invalid type`);
  if (!/^[A-Za-z0-9_-]{11}$/.test(video.youtubeId || "")) throw new Error(`${label} has an invalid YouTube ID`);
}

videos.forEach(validate);
const duplicateIds = videos.filter((video, index) => videos.findIndex((item) => item.id === video.id) !== index);
const duplicateYouTubeIds = videos.filter((video, index) => videos.findIndex((item) => item.youtubeId === video.youtubeId) !== index);
if (duplicateIds.length || duplicateYouTubeIds.length) throw new Error("The import contains duplicate video or YouTube IDs");

if (dryRun) {
  console.log(`Validated ${videos.length} archive video records. No database changes were made.`);
  process.exit(0);
}

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required");

const { createClient } = await import("@libsql/client");
const db = createClient({ url, authToken });
await db.batch([
  { sql: `CREATE TABLE IF NOT EXISTS archive_videos (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, date TEXT NOT NULL, service_type TEXT NOT NULL, title TEXT NOT NULL, preacher TEXT NOT NULL DEFAULT '', youtube_id TEXT NOT NULL UNIQUE, youtube_url TEXT NOT NULL, thumbnail_url TEXT NOT NULL DEFAULT '', duration_seconds INTEGER, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`, args: [] },
  { sql: "CREATE INDEX IF NOT EXISTS archive_videos_date_idx ON archive_videos(date DESC)", args: [] },
  { sql: "CREATE INDEX IF NOT EXISTS archive_videos_type_service_idx ON archive_videos(type, service_type)", args: [] },
  { sql: `CREATE TABLE IF NOT EXISTS member_app_access (member_id TEXT NOT NULL, app_code TEXT NOT NULL, access_level TEXT NOT NULL DEFAULT 'none' CHECK(access_level IN ('none', 'worship', 'full')), granted_by TEXT, granted_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (member_id, app_code))`, args: [] },
], "write");

const statements = videos.map((video) => ({
  sql: `INSERT INTO archive_videos (id, type, date, service_type, title, preacher, youtube_id, youtube_url, thumbnail_url, duration_seconds, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET type = excluded.type, date = excluded.date, service_type = excluded.service_type, title = excluded.title, preacher = excluded.preacher, youtube_id = excluded.youtube_id, youtube_url = excluded.youtube_url, thumbnail_url = excluded.thumbnail_url, duration_seconds = excluded.duration_seconds, note = excluded.note, updated_at = CURRENT_TIMESTAMP`,
  args: [video.id, video.type, video.date, video.serviceType, video.title, video.preacher || "", video.youtubeId, video.youtubeUrl, video.thumbnailUrl || "", video.durationSeconds, video.note || ""],
}));

for (let index = 0; index < statements.length; index += 50) {
  await db.batch(statements.slice(index, index + 50), "write");
}
console.log(`Imported ${videos.length} archive video records.`);
