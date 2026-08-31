import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("archive metadata requires an assigned archive level and omits playback data", () => {
  const source = read("app/api/archive/videos/route.ts");
  assert.match(source, /requireArchiveWorshipApi/);
  assert.match(source, /status:\s*403/);
  assert.match(source, /id:\s*video\.id/);
  assert.doesNotMatch(source, /youtubeId:\s*video\.youtubeId/);
  assert.doesNotMatch(source, /youtubeUrl:\s*video\.youtubeUrl/);
  assert.doesNotMatch(source, /thumbnailUrl:\s*video\.thumbnailUrl/);
  assert.match(source, /note:\s*""/);
});

test("playback requires an approved member session and archive level", () => {
  const source = read("app/api/archive/videos/[id]/playback/route.ts");
  assert.match(source, /getMemberSession\(\)/);
  assert.match(source, /status:\s*401/);
  assert.match(source, /forcePasswordChange/);
  assert.match(source, /getArchiveAccess\(member\.id\)/);
  assert.match(source, /canPlayArchiveVideo/);
  assert.match(source, /status:\s*403/);
  assert.match(source, /youtube-nocookie\.com/);
});

test("attendance thumbnails are replaced before authorization", () => {
  const source = read("lib/archive-thumbnail.ts");
  const route = read("app/api/archive/videos/[id]/thumbnail/route.ts");
  assert.match(route, /requireArchiveWorshipApi/);
  assert.match(route, /status:\s*403/);
  assert.match(source, /video\.type === "attendance"/);
  assert.match(source, /!canPlayArchiveVideo/);
  assert.match(source, /PLACEHOLDER/);
  assert.match(source, /private, no-store/);
  assert.match(source, /getSafeArchiveThumbnailUrl/);
});

test("song statistics use a separately configurable archive permission", () => {
  const access = read("lib/archive-access.ts");
  const archive = read("lib/archive.ts");
  const adminRoute = read("app/api/admin/archive/access/route.ts");
  for (const file of [
    "app/api/archive/songs/stats/route.ts",
    "app/api/archive/songs/export/route.ts",
    "app/api/archive/songs/[id]/history/route.ts",
  ]) assert.match(read(file), /requireArchiveSongApi/);
  assert.match(access, /getArchiveSongViewer/);
  assert.match(archive, /ARCHIVE_SONG_STATS_APP_CODE/);
  assert.match(archive, /row \? row\.access_level === "full" : true/);
  assert.match(adminRoute, /songStatsAllowed/);
});

test("YouTube URLs and thumbnail fetches only accept exact trusted hosts", () => {
  const source = read("lib/archive.ts");
  assert.match(source, /hostname === "youtube\.com" \|\| hostname\.endsWith\("\.youtube\.com"\)/);
  assert.match(source, /YOUTUBE_THUMBNAIL_HOSTS/);
  assert.doesNotMatch(source, /hostname\.endsWith\("youtube\.com"\)/);
});

test("archive mutations and member access changes require separate archive admin auth", () => {
  for (const file of [
    "app/api/admin/archive/videos/route.ts",
    "app/api/admin/archive/videos/[id]/route.ts",
    "app/api/admin/archive/access/route.ts",
  ]) {
    assert.match(read(file), /requireArchiveAdminApi/);
  }
  assert.match(read("app/archive-credential-auth.ts"), /mhji_archive_admin_session/);
  assert.match(read("app/archive-credential-auth.ts"), /ARCHIVE_ADMIN_SESSION_SECRET/);
  assert.doesNotMatch(read("app/admin/AdminDashboard.tsx"), /href="\/admin\/archive"/);
  assert.doesNotMatch(read("app/admin/members/AdminMembers.tsx"), /href="\/admin\/archive"/);
});

test("unlisted-video migration files remain excluded from Git", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /archive-videos\.seed\.json/);
  assert.match(gitignore, /\*\.sqlite/);
});
