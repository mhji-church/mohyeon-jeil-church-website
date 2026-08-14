import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("keeps mobile YouTube controls inside a stable accessible player viewport", () => {
  assert.match(homePage, /controls=1&fs=1&playsinline=1&hl=ko/);
  assert.match(
    styles,
    /\.featured-sermon-media iframe,[\s\S]*position: absolute;[\s\S]*inset: 0;/,
  );
  assert.match(
    styles,
    /\.featured-sermon-media\.is-playing\s*\{[\s\S]*height: max\(210px, 56\.25vw\);[\s\S]*contain: layout paint;/,
  );
  assert.match(
    styles,
    /\.video-modal-frame\s*\{[\s\S]*position: relative;[\s\S]*overflow: hidden;/,
  );
});
