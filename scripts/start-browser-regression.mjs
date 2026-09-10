import { pbkdf2Sync, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { createServer } from "vite";
import { applyNetlifyMigrations } from "./netlify-migrations.mjs";

const fixtureDirectory = path.resolve(".browser-test");
await rm(fixtureDirectory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
await mkdir(fixtureDirectory, { recursive: true });
const databasePath = path.join(fixtureDirectory, "browser.sqlite");
const databaseUrl = pathToFileURL(databasePath).href;
const client = createClient({ url: databaseUrl });
await applyNetlifyMigrations(client);

const salt = randomBytes(16);
const hash = pbkdf2Sync("browser-test-password", salt, 100_000, 32, "sha256");
const base64url = (value) => Buffer.from(value).toString("base64url");
await client.execute({
  sql: "INSERT INTO members (id, username, password_hash, password_salt, name, phone, position, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  args: ["browser-member", "test-member", base64url(hash), base64url(salt), "브라우저테스트", "01000000000", "집사 / 미디어팀", "approved"],
});
for (let index = 1; index <= 12; index += 1) {
  await client.execute({
    sql: "INSERT INTO members (id, username, password_hash, password_salt, name, phone, position, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [`browser-admin-member-${index}`, `browser-user-${index}`, base64url(hash), base64url(salt), `가상 회원 ${index}`, `0109000${String(index).padStart(4, "0")}`, index % 2 ? "집사 / 남전도회" : "권사", index <= 2 ? "pending" : index === 12 ? "suspended" : "approved", `2026-09-${String(13 - index).padStart(2, "0")}T00:00:00.000Z`],
  });
}
await client.execute({
  sql: "INSERT INTO member_app_access (member_id, app_code, access_level, granted_by) VALUES (?, 'worship_archive', 'full', 'browser-fixture')",
  args: ["browser-member"],
});
await client.execute({
  sql: "INSERT INTO archive_videos (id, type, date, service_type, title, preacher, youtube_id, youtube_url, thumbnail_url, duration_seconds, note) VALUES (?, 'worship', ?, ?, ?, ?, ?, ?, '', ?, '')",
  args: ["browser-archive-video", "2026.09.01", "주일 2부 예배", "브라우저 아카이브 영상", "담임목사", "browserVideo01", "https://www.youtube.com/watch?v=browserVideo01", 3600],
});
for (let index = 1; index <= 12; index += 1) {
  const date = `2026.08.${String(index).padStart(2, "0")}`;
  await client.execute({ sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'published')", args: [`browser-bulletin-${index}`, "bulletin", `브라우저 주보 ${index}`, date, "로컬 회귀검사", "", "[]"] });
}
for (let index = 1; index <= 12; index += 1) {
  const date = `2026.09.${String(index).padStart(2, "0")}`;
  await client.execute({ sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, 'news', ?, ?, ?, ?, '[]', 'published')", args: [`browser-news-${index}`, `브라우저 교회소식 ${index}`, date, "로컬 회귀검사", JSON.stringify([["안내", "브라우저 회귀검사 데이터"]])] });
}
const galleryBody = Array.from(
  { length: 14 },
  (_, index) => `모현제일교회 갤러리 본문 ${index + 1}. 함께한 예배와 교제의 순간을 기록합니다.`,
).join("\n");
await client.execute({
  sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, 'gallery', ?, ?, ?, ?, ?, 'published')",
  args: [
    "browser-gallery",
    "브라우저 갤러리",
    "2026.08.20",
    "로컬 회귀검사",
    galleryBody,
    JSON.stringify([
      "/assets/mhji/gallery-pink-04.jpg",
      "/assets/mhji/gallery-pink-03.jpg",
    ]),
  ],
});
for (const [id, title, image] of [
  ["browser-square", "정사각형 한 장 앨범", "/assets/icon-512.png"],
  ["browser-portrait", "세로형 사진과 함께 확인하는 아주 긴 앨범 제목입니다 글자가 확대되어도 닫기 버튼은 항상 눌릴 수 있어야 합니다", "/assets/hero-flowers-mobile.webp"],
]) {
  await client.execute({
    sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, 'gallery', ?, '2026.08.19', '로컬 화면 검증', ?, ?, 'published')",
    args: [id, title, galleryBody, JSON.stringify([image])],
  });
}
for (let index = 1; index <= 10; index += 1) {
  const date = `2026.07.${String(index).padStart(2, "0")}`;
  await client.execute({
    sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, 'business', ?, ?, ?, ?, ?, 'published')",
    args: [`browser-business-${index}`, `가상 성도사업장 ${index}`, date, "모바일 관리자 목록 확인용 소개", JSON.stringify({ owner: `가상 대표 ${index}`, address: "용인시", phone: "010-0000-0000", website: "" }), JSON.stringify(["/assets/icon-512.png"])],
  });
  await client.execute({
    sql: "INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [`browser-audit-${index}`, "browser-admin", index % 2 ? "content.update" : "archive.access.update", index % 2 ? "content" : "member", `virtual-${index}`, JSON.stringify({ source: "browser-fixture", result: "success" }), `2026-09-${String(11 - index).padStart(2, "0")}T10:30:00.000Z`],
  });
}
await client.close();

Object.assign(process.env, {
  TURSO_DATABASE_URL: databaseUrl,
  TURSO_AUTH_TOKEN: "browser-test-token",
  ADMIN_USERNAME: "browser-admin",
  ADMIN_PASSWORD: "browser-admin-password",
  ADMIN_SESSION_SECRET: "browser-admin-session-secret",
  MEMBER_SESSION_SECRET: "browser-member-session-secret",
  ARCHIVE_ADMIN_USERNAME: "browser-archive-admin",
  ARCHIVE_ADMIN_PASSWORD: "browser-archive-password",
  ARCHIVE_ADMIN_SESSION_SECRET: "browser-archive-session-secret",
  WRANGLER_LOG_PATH: ".browser-test/wrangler.log",
});
const server = await createServer({ server: { host: "127.0.0.1", port: 4178 } });
await server.listen();
const serveOnly = process.argv.includes("--serve-only");
if (serveOnly) {
  console.log("Browser fixture server: http://127.0.0.1:4178");
  await new Promise((resolve) => {
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, resolve);
  });
  server.ws.close();
  server.httpServer?.closeAllConnections?.();
  await server.close();
  process.exit(0);
}
const playwrightCli = path.resolve("node_modules", "@playwright", "test", "cli.js");
const runner = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2).filter((argument) => argument !== "--serve-only")], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => runner.kill(signal));
}
const exitCode = await new Promise((resolve) => {
  runner.once("exit", (code) => resolve(code ?? 1));
  runner.once("error", () => resolve(1));
});
server.ws.close();
server.httpServer?.closeAllConnections?.();
await Promise.race([
  server.close(),
  new Promise((resolve) => setTimeout(resolve, 2_000)),
]);
process.exit(exitCode);
