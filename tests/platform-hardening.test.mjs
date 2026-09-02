import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("runtime database access contains no schema mutation or automatic seed", () => {
  const database = read("lib/netlify-db.ts");
  const content = read("lib/content.ts");
  assert.doesNotMatch(database, /CREATE TABLE|CREATE INDEX|ALTER TABLE/i);
  assert.doesNotMatch(content, /CREATE TABLE|CREATE INDEX|seedPosts/i);
  assert.match(read("scripts/migrate-netlify.mjs"), /CONTEXT !== "production"|CONTEXT === "production"/);
  assert.match(read("scripts/migrate-netlify.mjs"), /agent\/netlify-deployment/);
});

test("safe API errors never serialize internal exception messages", () => {
  const response = read("lib/api-response.ts");
  assert.match(response, /requestId/);
  assert.match(response, /JSON\.stringify\(\{ requestId, context, cause: safeErrorCause/);
  assert.doesNotMatch(response, /error\.message/);
  assert.match(response, /"Cache-Control": "private, no-store/);
});

test("Netlify cache and report-only security headers separate public and private routes", () => {
  const netlify = read("netlify.toml");
  assert.match(netlify, /Content-Security-Policy-Report-Only/);
  assert.match(netlify, /frame-ancestors 'none'/);
  assert.match(netlify, /https:\/\/www\.youtube-nocookie\.com/);
  assert.match(netlify, /https:\/\/dapi\.kakao\.com/);
  assert.doesNotMatch(netlify, /unsafe-eval/);
  for (const route of ["/api/*", "/admin/*", "/member/*", "/archive/*"]) {
    const blockStart = netlify.indexOf(`for = "${route}"`);
    assert.notEqual(blockStart, -1);
    assert.match(netlify.slice(blockStart, blockStart + 160), /private, no-store/);
  }
  assert.match(netlify, /for = "\/"[\s\S]{0,120}s-maxage=60/);
});

test("only transient reads retry and mutation helpers never retry", () => {
  const database = read("lib/netlify-db.ts");
  assert.match(database, /isReadStatement\(statement\.sql\)/);
  assert.match(database, /readRetryDelayMs = 150/);
  assert.match(database, /async run\(\)[\s\S]*this\.client\.execute/);
  assert.match(database, /async batch\(statements[\s\S]*this\.client\.batch/);
  assert.doesNotMatch(database, /async run\(\)[\s\S]{0,250}executeRead/);
  assert.doesNotMatch(database, /async batch\(statements[\s\S]{0,350}executeRead/);
});

test("audit metadata excludes sensitive fields and has a fixed page size", () => {
  const audit = read("lib/admin-audit.ts");
  assert.match(audit, /password\|token\|secret\|phone\|birth\|content\|body\|image\|url/i);
  assert.match(audit, /const pageSize = 20/);
  assert.match(audit, /INSERT INTO admin_audit_logs/);
});

test("service worker only caches public static resources and waits for consent to update", () => {
  const worker = read("public/sw.js");
  const home = read("app/page.tsx");
  assert.match(worker, /SKIP_WAITING/);
  assert.doesNotMatch(worker, /addEventListener\("install"[\s\S]{0,300}skipWaiting/);
  for (const prefix of ["\/api\/", "\/admin", "\/member", "\/archive", "\/gallery"]) assert.match(worker, new RegExp(prefix));
  assert.match(home, /새 버전이 있습니다/);
  assert.match(home, /controllerchange/);
});

test("private routes are noindex and public discovery files exist", () => {
  for (const file of ["app/admin/layout.tsx", "app/member/layout.tsx", "app/archive/admin/layout.tsx"]) {
    assert.match(read(file), /index: false/);
  }
  assert.match(read("app/sitemap.ts"), /https:\/\/mhji\.kr/);
  assert.match(read("app/robots.ts"), /\/admin/);
});
