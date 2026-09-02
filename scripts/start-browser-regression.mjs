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
  sql: "INSERT INTO members (id, username, password_hash, password_salt, name, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
  args: ["browser-member", "test-member", base64url(hash), base64url(salt), "브라우저테스트", "01000000000", "approved"],
});
await client.execute({
  sql: "INSERT INTO member_app_access (member_id, app_code, access_level, granted_by) VALUES (?, 'worship_archive', 'full', 'browser-fixture')",
  args: ["browser-member"],
});
for (let index = 1; index <= 12; index += 1) {
  const date = `2026.08.${String(index).padStart(2, "0")}`;
  await client.execute({ sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'published')", args: [`browser-bulletin-${index}`, "bulletin", `브라우저 주보 ${index}`, date, "로컬 회귀검사", "", "[]"] });
}
await client.execute({ sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, 'news', ?, ?, ?, ?, '[]', 'published')", args: ["browser-news", "브라우저 교회소식", "2026.08.20", "로컬 회귀검사", JSON.stringify([["안내", "브라우저 회귀검사 데이터"]])] });
await client.execute({ sql: "INSERT INTO content_posts (id, type, title, date, excerpt, content, images, status) VALUES (?, 'gallery', ?, ?, ?, '', ?, 'published')", args: ["browser-gallery", "브라우저 갤러리", "2026.08.20", "로컬 회귀검사", JSON.stringify(["/assets/mhji/gallery-pink-04.jpg"])] });
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
const playwrightCli = path.resolve("node_modules", "@playwright", "test", "cli.js");
const runner = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
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
