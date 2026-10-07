import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { applyNetlifyMigrations } from "../scripts/netlify-migrations.mjs";
import { classifyDevice, classifySource, koreaClock, normalizeAnalyticsPath, periodRange, sanitizeCampaign, sanitizeReferrerHost } from "../lib/analytics-model.ts";

let server;
let port;
let base;
let directory;
let database;
let archiveCookie;
let websiteCookie;
let memberCookie;
let visitorCookie;
const browserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36";

test("Korean calendar boundaries, source/device classification and privacy allowlist", () => {
  assert.equal(koreaClock(new Date("2026-12-31T14:59:59Z")).day, "2026-12-31");
  assert.equal(koreaClock(new Date("2026-12-31T15:00:00Z")).day, "2027-01-01");
  assert.deepEqual(periodRange("week", "2027-01-01", "2026-10-07").start, "2026-12-28");
  assert.deepEqual(periodRange("year", "2027-01-01", "2026-10-07").start, "2027-01-01");
  assert.equal(normalizeAnalyticsPath("/gallery/person-token"), "/gallery/detail");
  assert.equal(normalizeAnalyticsPath("/admin"), null);
  assert.equal(sanitizeCampaign("person@example.com"), "");
  assert.equal(sanitizeReferrerHost("https://www.google.com/search?q=private"), "google.com");
  assert.equal(classifySource("google.com", "", "").category, "search");
  assert.equal(classifyDevice("Mozilla/5.0 (iPhone) AppleWebKit/605.1 Safari/605.1").device, "mobile");
});

async function freePort() {
  return new Promise((resolve, reject) => { const probe = net.createServer(); probe.once("error", reject); probe.listen(0, "127.0.0.1", () => { const address = probe.address(); probe.close(() => resolve(address.port)); }); });
}
const request = (pathname, init) => fetch(`${base}${pathname}`, init);
const originHeaders = () => ({ origin: base, "content-type": "application/json", "user-agent": browserAgent });

before(async () => {
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  directory = await mkdtemp(path.join(os.tmpdir(), "mhji-analytics-test-"));
  const dbUrl = pathToFileURL(path.join(directory, "temporary.sqlite")).href;
  database = createClient({ url: dbUrl });
  await applyNetlifyMigrations(database);
  const salt = randomBytes(16);
  const hash = pbkdf2Sync("virtual-member-password", salt, 100_000, 32, "sha256");
  await database.execute({ sql: "INSERT INTO members (id, username, password_hash, password_salt, name, phone, status) VALUES (?, ?, ?, ?, ?, ?, 'approved')", args: ["virtual-same-name-member", "site-test-admin", hash.toString("base64url"), salt.toString("base64url"), "가상 교인", "01000000000"] });
  const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  server = spawn(process.execPath, [vite, "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, NODE_ENV: "development", TURSO_DATABASE_URL: dbUrl, TURSO_AUTH_TOKEN: "local-test-token", ADMIN_USERNAME: "site-test-admin", ADMIN_PASSWORD: "local-site-password", ARCHIVE_ADMIN_USERNAME: "archive-test-admin", ARCHIVE_ADMIN_PASSWORD: "local-archive-password", ADMIN_SESSION_SECRET: "local-analytics-session-secret", MEMBER_SESSION_SECRET: "local-analytics-member-secret", YOUTUBE_API_KEY: "local-test-key-not-used" },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (server.exitCode !== null) throw new Error("Temporary analytics server stopped during startup");
    try { const response = await request("/member/login"); if (response.status === 200) return; } catch { /* startup */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Temporary analytics server did not respond");
});

after(async () => {
  if (server?.exitCode === null) { server.kill(); await new Promise((resolve) => { server.once("exit", resolve); setTimeout(resolve, 3000); }); }
  await database?.close();
  if (directory) {
    try { await rm(directory, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 }); }
    catch (error) { if (error?.code !== "EBUSY") throw error; }
  }
});

test("both signed administrator credential slots may open the page, report and CSV", async () => {
  const website = await request("/api/admin/session", { method: "POST", headers: originHeaders(), body: JSON.stringify({ username: "site-test-admin", password: "local-site-password" }) });
  assert.equal(website.status, 200);
  websiteCookie = website.headers.get("set-cookie")?.split(";")[0];
  const archive = await request("/api/admin/session", { method: "POST", headers: originHeaders(), body: JSON.stringify({ username: "archive-test-admin", password: "local-archive-password" }) });
  assert.equal(archive.status, 200);
  archiveCookie = archive.headers.get("set-cookie")?.split(";")[0];
  const member = await request("/api/members/session", { method: "POST", headers: originHeaders(), body: JSON.stringify({ username: "site-test-admin", password: "virtual-member-password" }) });
  assert.equal(member.status, 200);
  memberCookie = member.headers.get("set-cookie")?.split(";")[0];
  for (const pathname of ["/api/admin/analytics", "/api/admin/analytics/export"]) {
    for (const cookie of [undefined, memberCookie, "mhji_admin_session=invalid"]) {
      const response = await request(pathname, { headers: cookie ? { cookie } : {} });
      assert.equal(response.status, 403);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    }
    for (const cookie of [websiteCookie, archiveCookie]) {
      const response = await request(pathname, { headers: { cookie } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control") ?? "", /private, no-store/);
    }
  }
  const memberPage = await request("/admin/analytics", { headers: { cookie: memberCookie }, redirect: "manual" });
  assert.notEqual(memberPage.status, 200);
  for (const cookie of [websiteCookie, archiveCookie]) {
    const allowedPage = await request("/admin/analytics", { headers: { cookie } });
    assert.equal(allowedPage.status, 200);
    assert.doesNotMatch(allowedPage.headers.get("cache-control") ?? "", /public/i);
    const home = await request("/admin", { headers: { cookie } });
    assert.equal(home.status, 200);
    assert.match(await home.text(), /오늘의 접속/);
  }
  const csv = await request("/api/admin/analytics/export", { headers: { cookie: archiveCookie } });
  const bytes = new Uint8Array(await csv.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
});

test("automatic first-party collection, validation, deduplication and no raw personal data", async () => {
  const foreignOrigin = await request("/api/analytics/collect", { method: "POST", headers: { ...originHeaders(), origin: "https://another.example" }, body: JSON.stringify({ events: [{ id: randomUUID(), kind: "pageview", path: "/" }] }) });
  assert.equal(foreignOrigin.status, 403);
  const event = { id: randomUUID(), kind: "pageview", path: "/gallery" };
  let headers = originHeaders();
  for (const expected of [1, 0]) {
    const response = await request("/api/analytics/collect", { method: "POST", headers, body: JSON.stringify({ events: [event], referrerHost: "https://www.google.com/search?q=private", utmCampaign: "Autumn_2026" }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).stored, expected);
    if (expected === 1) {
      visitorCookie = response.headers.get("set-cookie")?.split(";")[0];
      assert.ok(visitorCookie?.startsWith("mhji_analytics_visitor="));
      headers = { ...originHeaders(), cookie: visitorCookie };
    } else assert.equal(response.headers.get("set-cookie"), null);
  }
  const deniedPath = await request("/api/analytics/collect", { method: "POST", headers, body: JSON.stringify({ events: [{ id: randomUUID(), kind: "pageview", path: "/admin" }] }) });
  assert.equal(deniedPath.status, 400);
  const adminVisit = await request("/api/analytics/collect", { method: "POST", headers: { ...headers, cookie: `${visitorCookie}; ${archiveCookie}` }, body: JSON.stringify({ events: [{ id: randomUUID(), kind: "pageview", path: "/" }] }) });
  assert.equal(adminVisit.status, 204);
  const report = await request("/api/admin/analytics?period=all", { headers: { cookie: archiveCookie } });
  const data = await report.json();
  assert.equal(data.metrics.visitors, 1);
  assert.equal(data.metrics.visits, 1);
  assert.equal(data.metrics.pageviews, 1);
  const home = await request("/admin", { headers: { cookie: websiteCookie } });
  const homeMarkup = await home.text();
  assert.match(homeMarkup, /오늘의 접속/);
  assert.match(homeMarkup, /오늘 페이지 조회수/);
  assert.equal(data.sources[0].label, "search");
  const stored = await database.execute("SELECT path FROM analytics_events");
  assert.deepEqual(stored.rows.map((row) => row.path), ["/gallery"]);
  await database.execute("UPDATE analytics_sessions SET last_seen_at = '2026-01-01T00:00:00.000Z'");
  const nextVisit = await request("/api/analytics/collect", { method: "POST", headers, body: JSON.stringify({ events: [{ id: randomUUID(), kind: "pageview", path: "/bulletin" }] }) });
  assert.equal(nextVisit.status, 200);
  const anotherVisit = await request("/api/analytics/collect", { method: "POST", headers: originHeaders(), body: JSON.stringify({ events: [{ id: randomUUID(), kind: "pageview", path: "/gallery" }] }) });
  assert.equal(anotherVisit.status, 200);
  const refreshed = await request("/api/admin/analytics?period=all", { headers: { cookie: archiveCookie } });
  const totals = (await refreshed.json()).metrics;
  assert.equal(totals.visitors, 2);
  assert.equal(totals.visits, 3);
  assert.equal(totals.pageviews, 3);
  const schema = await database.execute("SELECT sql FROM sqlite_schema WHERE name LIKE 'analytics_%'");
  assert.doesNotMatch(schema.rows.map((row) => String(row.sql)).join(" "), /raw_ip|member_id|email|password/i);
});

test("a known gallery detail uses its registered title without changing pageview totals", async () => {
  await database.execute({ sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, 'gallery', ?, '2026.10.08', '', '', '[]', 'published')", args: ["virtual-gallery-title", "가상 갤러리 긴 제목"] });
  const event = { id: randomUUID(), kind: "pageview", path: "/gallery/virtual-gallery-title", contentType: "gallery", contentId: "virtual-gallery-title" };
  const collected = await request("/api/analytics/collect", { method: "POST", headers: { ...originHeaders(), cookie: visitorCookie }, body: JSON.stringify({ events: [event] }) });
  assert.equal(collected.status, 200);
  const report = await request("/api/admin/analytics?period=all", { headers: { cookie: websiteCookie } });
  assert.equal(report.status, 200);
  const data = await report.json();
  assert.equal(data.pages.find((page) => page.contentId === "virtual-gallery-title")?.title, "가상 갤러리 긴 제목");
  assert.equal(data.metrics.pageviews, 4);
});
