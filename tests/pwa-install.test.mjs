import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the church name for PWA installation", async () => {
  const manifest = JSON.parse(await readFile("public/manifest.webmanifest", "utf8"));

  assert.equal(manifest.name, "모현제일교회");
  assert.equal(manifest.short_name, "모현제일교회");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.display, "standalone");
});

test("keeps the compact install trigger separate from the install action", async () => {
  const [page, styles] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);

  assert.match(page, /className="home-install-trigger"/);
  assert.match(page, /className="home-install-panel"/);
  assert.match(page, /installPrompt\.prompt\(\)/);
  assert.match(page, /iPhone·iPad에서는 자동 설치가 지원되지 않습니다/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /\.home-install-trigger\s*{[\s\S]*?width: 46px;[\s\S]*?height: 46px;/);
  assert.match(styles, /\.home-scroll-top\s*{[\s\S]*?display: none;/);
});

test("keeps one shared header and footer source", async () => {
  const sourceFiles = [
    "app/components/ContentPage.tsx",
    "app/member/page.tsx",
    "app/member/login/page.tsx",
    "app/member/signup/page.tsx",
    "app/member/password/page.tsx",
  ];

  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /\bSiteHeader\b/);
    assert.doesNotMatch(source, /\bSiteFooter\b/);
  }

  const layoutChrome = await readFile("app/components/SiteLayoutChrome.tsx", "utf8");
  assert.equal((layoutChrome.match(/<SiteHeader\b/g) ?? []).length, 1);
  assert.equal((layoutChrome.match(/<SiteFooter\b/g) ?? []).length, 1);
});

test("exposes the worship archive from desktop and mobile navigation", async () => {
  const siteChrome = await readFile("app/components/SiteChrome.tsx", "utf8");

  assert.match(siteChrome, /label: "예배 아카이브",\s*href: "\/archive"/);
  assert.doesNotMatch(siteChrome, /준비 중/);
  assert.doesNotMatch(siteChrome, /aria-disabled="true"/);
});

test("preserves editable defaults and conditional business links", async () => {
  const [admin, business, video] = await Promise.all([
    readFile("app/admin/AdminDashboard.tsx", "utf8"),
    readFile("app/business/page.tsx", "utf8"),
    readFile("app/components/VideoArchivePage.tsx", "utf8"),
  ]);

  assert.match(admin, /date: getKoreaDate\(\)/);
  assert.match(admin, /date: form\.date/);
  assert.doesNotMatch(admin, /readOnly={!editingId}/);
  assert.match(business, /websiteInput && !\/\^https\?:\\\/\\\/\?\$\/i\.test\(websiteInput\)/);
  assert.match(video, /const contentRevealOffset = mobile \? 42 : 76/);
  assert.match(video, /const targetTop = sectionTop - headerOffset \+ contentRevealOffset/);
  assert.doesNotMatch(video, /paginationBottom/);
  assert.doesNotMatch(video, /window\.innerHeight/);
});
