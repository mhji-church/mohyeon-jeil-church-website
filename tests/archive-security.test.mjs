import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("public archive metadata does not expose YouTube playback data", () => {
  const source = read("app/api/archive/videos/route.ts");
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
  assert.match(source, /video\.type === "attendance"/);
  assert.match(source, /!canPlayArchiveVideo/);
  assert.match(source, /PLACEHOLDER/);
  assert.match(source, /private, no-store/);
});

test("archive mutations and member access changes require homepage admin auth", () => {
  for (const file of [
    "app/api/admin/archive/videos/route.ts",
    "app/api/admin/archive/videos/[id]/route.ts",
    "app/api/admin/archive/access/route.ts",
  ]) {
    assert.match(read(file), /requireAdminApi/);
  }
});

test("unlisted-video migration files remain excluded from Git", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /archive-videos\.seed\.json/);
  assert.match(gitignore, /\*\.sqlite/);
});
