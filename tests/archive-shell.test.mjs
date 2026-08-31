import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("archive routes use an independent application shell", () => {
  const chrome = read("app/components/SiteLayoutChrome.tsx");
  const route = read("app/archive/[section]/page.tsx");
  const portal = read("app/archive/ArchivePortal.tsx");
  const shell = read("app/archive/ArchiveShell.tsx");

  assert.match(chrome, /pathname\?\.startsWith\("\/archive"\)/);
  assert.match(route, /"sunday", "other", "attendance"/);
  assert.match(route, /requireArchiveWorshipPage/);
  assert.match(read("app/archive/page.tsx"), /requireArchiveWorshipPage/);
  assert.match(shell, /"\/archive\/sunday"/);
  assert.match(shell, /"\/archive\/other"/);
  assert.match(shell, /"\/archive\/attendance"/);
  assert.match(shell, /archive-original-root/);
  assert.doesNotMatch(portal, /<SiteHeader|<SiteFooter|<iframe[^>]+src="\/archive/);
});

test("archive shell keeps brand, navigation, return path, and theme controls", () => {
  const portal = read("app/archive/ArchivePortal.tsx");
  const shell = read("app/archive/ArchiveShell.tsx");
  const styles = read("app/archive/archive-original.css");

  assert.match(shell, /src="\/archive\/brand\/mohyeon-logo-light\.png"/);
  assert.match(shell, /src="\/archive\/brand\/mohyeon-logo-dark\.png"/);
  assert.doesNotMatch(styles, /brand-logo[^}]*filter:/s);
  assert.match(shell, /교회 홈페이지로/);
  assert.match(portal, /return_to=\$\{encodeURIComponent\(pathname \|\| "\/archive"\)\}/);
  assert.match(shell, /mhji-archive-theme/);
  assert.match(shell, /prefers-color-scheme: dark/);
  assert.match(shell, /mobile-bottom-nav\$\{showSongs/);
  assert.match(shell, /showSongs/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /min-height: 74px/);
  assert.match(styles, /PretendardVariable\.woff2/);
});

test("archive records remain responsive, protected, and 16 by 9", () => {
  const portal = read("app/archive/ArchivePortal.tsx");
  const songs = read("app/archive/songs/SongStats.tsx");
  const shell = read("app/archive/ArchiveShell.tsx");
  const styles = read("app/archive/archive-original.css");

  assert.match(portal, /videos\.slice\(0, recentCount\)/);
  assert.match(shell, /href="\/archive\/admin"/);
  assert.match(portal, /attendance-obscured/);
  assert.match(portal, /formatAttendanceTitle/);
  assert.match(portal, /attendance-title-mobile/);
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /aspect-ratio: 16 \/ 9/);
  assert.match(styles, /filter: blur\(9px\)/);
  assert.match(styles, /-webkit-line-clamp: 2/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /\.site-header \.brand-service \{ display: none; \}/);
  assert.match(songs, /<ArchiveIcon name="user"/);
  assert.match(songs, /<span>\{viewerName\}<\/span>/);
  assert.match(songs, /className="song-search-button"/);
  assert.match(songs, /setAppliedQuery\(query\.trim\(\)\)/);
  assert.match(styles, /\.song-export-button \{ display: none; \}/);
  assert.doesNotMatch(songs, /같은 찬양은 한 예배에서 한 번만 집계하며/);
  assert.match(styles, /\.song-summary-grid \.wide \{ grid-column: 1 \/ -1; \}/);
  assert.match(styles, /\.song-summary-grid \.wide strong \{ overflow: visible;/);
  assert.match(styles, /\.attendance-title-mobile \{ display: block;[^}]*white-space: nowrap;/);
});
