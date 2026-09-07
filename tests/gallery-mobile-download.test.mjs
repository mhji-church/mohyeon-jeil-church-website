import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("mobile gallery uses full-width cards and keeps the detail body scrollable", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.gallery-album-card \{ display: block;/);
  assert.match(styles, /\.gallery-album-cover \{[^}]*aspect-ratio: 16 \/ 10;/);
  assert.match(styles, /\.gallery-album-cover img \{[^}]*object-fit: contain;/);
  assert.match(styles, /\.gallery-viewer-content \{[^}]*overflow-y: auto;/);
  assert.match(styles, /\.gallery-viewer-panel \{[^}]*height: 100dvh;[^}]*overflow: hidden;/);
  assert.match(styles, /\.gallery-detail-copy > p \{[^}]*display: block;/);
  assert.doesNotMatch(styles, /\.gallery-modal-bottom > p \{ display: none;/);
  assert.match(styles, /\.gallery-download-actions \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.gallery-download-actions \{ display: block;/);
  assert.match(styles, /\.gallery-download-button \{[^}]*width: 100%;[^}]*min-height: 56px;/);
});

test("gallery download resolves only a validated post image and never accepts a client URL", () => {
  const route = read("app/api/gallery/download/route.ts");
  const mediaRoute = read("app/api/gallery/media/route.ts");
  const viewer = read("app/gallery/GalleryViewer.tsx");
  const worker = read("public/sw.js");
  const vite = read("vite.config.ts");

  assert.match(route, /member\?\.status !== "approved" && !admin/);
  assert.match(route, /request\.headers\.get\("cookie"\)/);
  assert.match(route, /getMemberSessionFromToken\(cookieValue\(cookieHeader, "mhji_member_session"\)\)/);
  assert.match(mediaRoute, /request\.headers\.get\("cookie"\)/);
  assert.match(mediaRoute, /getMemberSessionFromToken\(cookieValue\(cookieHeader, "mhji_member_session"\)\)/);
  assert.match(vite, /url\.pathname === "\/api\/gallery\/media"/);
  assert.match(vite, /serveGalleryMedia/);
  assert.match(route, /post\.type !== "gallery" \|\| post\.status !== "published"/);
  assert.match(route, /post\.images\[imageIndex\]/);
  assert.match(route, /object\.key\.startsWith\("gallery\/"\)/);
  assert.match(route, /"https:\/\/mhji\.kr"/);
  assert.doesNotMatch(route, /new URL\(source, request\.url\)/);
  assert.match(mediaRoute, /key\.key\.startsWith\("gallery\/"\)/);
  assert.match(mediaRoute, /"https:\/\/mhji\.kr"/);
  assert.doesNotMatch(route, /searchParams\.get\("(?:url|src|source)"\)/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /filename\*=UTF-8''/);
  assert.match(viewer, /post_id=\$\{encodeURIComponent\(album\.id\)\}&image=\$\{activeImage\}/);
  assert.match(viewer, /disabled=\{downloading\}/);
  assert.match(viewer, /원본 사진 열기/);
  assert.match(worker, /const PRIVATE_PREFIXES = \[[^\]]*"\/api\/"/);
});
