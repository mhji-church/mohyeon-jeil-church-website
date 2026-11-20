import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import { createClient } from "@libsql/client";
import { applyNetlifyMigrations } from "../scripts/netlify-migrations.mjs";

const require = createRequire(import.meta.url);
function load(file, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(name => dependencies[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}

test("manual playlist sync replaces only complete snapshots, gates requests, and shares the public cache", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mhji-youtube-sync-"));
  const saved = { url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN, key: process.env.YOUTUBE_API_KEY, fetch: globalThis.fetch };
  process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, "test.sqlite")).href;
  process.env.TURSO_AUTH_TOKEN = "temporary-test";
  process.env.YOUTUBE_API_KEY = "mock-youtube-key";
  const client = createClient({ url: process.env.TURSO_DATABASE_URL });
  await applyNetlifyMigrations(client);
  const db = load("../lib/netlify-db.ts");
  const youtube = load("../lib/youtube.ts", { "./netlify-db": db });
  let admin = true;
  const api = load("../app/api/admin/youtube/sync/route.ts", {
    "../../../../admin-auth": { requireAdminApi: async () => admin ? { canManageWebsite: true, canManageArchive: admin === true } : null },
    "../../../../../lib/youtube": youtube,
  });
  const post = (origin = "https://local.example") => api.POST(new Request("https://local.example/api/admin/youtube/sync", { method: "POST", headers: { origin } }));
  const unlock = () => client.execute("UPDATE youtube_sync_locks SET lease_until=0, next_allowed_at=0");
  const stored = async () => (await client.execute("SELECT videos_json, updated_at FROM youtube_playlist_cache WHERE playlist_type='sermons'")).rows[0];
  const item = (id, date) => ({ snippet: { title: `말씀 ${id} | 성경 본문 | 테스트 목사 (${date})`, resourceId: { videoId: id }, publishedAt: "2026-11-01T00:00:00Z" } });
  try {
    let calls = 0;
    globalThis.fetch = async url => {
      calls++;
      const second = new URL(url).searchParams.get("pageToken");
      return Response.json(second ? { items: [item("late-video", "2026년 11월 15일")], pageInfo: { totalResults: 51 } } : {
        items: Array.from({ length: 50 }, (_, i) => item(`video-${i}`, "2026년 11월 8일")), nextPageToken: "page-2", pageInfo: { totalResults: 51 },
      });
    };
    admin = false;
    assert.equal((await post()).status, 403);
    assert.equal((await api.GET()).status, 403);
    admin = "website-only";
    assert.equal((await post()).status, 403);
    assert.equal((await api.GET()).status, 403);
    admin = true;
    assert.equal((await post("https://other.example")).status, 403);
    assert.equal(calls, 0);
    const result = await post();
    assert.equal(result.status, 200);
    assert.equal((await result.json()).count, 51);
    assert.equal(calls, 2);
    const videos = await youtube.getCachedYouTubePlaylistVideos("sermons");
    assert.equal(videos[0].videoId, "late-video");
    assert.match(videos[0].detail, /성경 본문 · 테스트 목사/);
    assert.equal((await post()).status, 429);
    assert.equal(calls, 2);
    assert.ok((await (await api.GET()).json()).updatedAt);
    const previous = await stored();
    for (const response of [{ items: [] }, {}, { items: [item("partial", "2026년 11월 15일")], pageInfo: { totalResults: 20 } }, { error: { message: "private API details" } }]) {
      await unlock();
      globalThis.fetch = async () => Response.json(response);
      const failed = await post();
      assert.equal(failed.status, 502);
      assert.doesNotMatch(await failed.text(), /private API details|mock-youtube-key/);
      assert.deepEqual(await stored(), previous);
    }
    await unlock();
    globalThis.fetch = async url => new URL(url).searchParams.has("pageToken") ? new Response("failure", { status: 503 }) : Response.json({ items: [item("partial", "2026년 11월 15일")], nextPageToken: "next" });
    assert.equal((await post()).status, 502);
    assert.deepEqual(await stored(), previous);
    await unlock();
    let release;
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    globalThis.fetch = async () => { started(); return new Promise(resolve => { release = () => resolve(Response.json({ items: [item("single", "2026년 11월 15일")] })); }); };
    const first = post();
    await ready;
    assert.equal((await post()).status, 429);
    release();
    assert.equal((await first).status, 200);
    // Both public consumers request this same dynamic, non-cacheable endpoint.
    assert.match(readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"), /\/api\/youtube\?type=sermons/);
    assert.match(readFileSync(new URL("../app/components/VideoArchivePage.tsx", import.meta.url), "utf8"), /\/api\/youtube\?type=\$\{playlistType\}/);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [key, value] of [["TURSO_DATABASE_URL", saved.url], ["TURSO_AUTH_TOKEN", saved.token], ["YOUTUBE_API_KEY", saved.key]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    client.close();
  }
});
