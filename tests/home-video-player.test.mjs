import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("uses slim custom mobile playback and draggable volume controls", () => {
  assert.match(homePage, /controls=1&fs=1/);
  assert.match(homePage, /iv_load_policy=3/);
  assert.match(homePage, /disablekb=0/);
  assert.match(homePage, /Math\.max\(480, host\.clientWidth \/ 0\.75\)/);
  assert.match(homePage, /width: mobileFrameLayout\.width,[\s\S]*height: mobileFrameLayout\.height,[\s\S]*transform: `scale\(\$\{mobileFrameLayout\.scale\}\)`/);
  assert.match(homePage, /style=\{frameStyle\}/);
  assert.match(homePage, /pointerEvents: "auto"/);
  assert.doesNotMatch(homePage, /nativeControlsActive/);
  assert.doesNotMatch(homePage, /유튜브 자막 설정 열기/);
  assert.doesNotMatch(homePage, /유튜브 화질 설정 열기/);
  assert.match(homePage, /if \(data === 0\) setHasEnded\(true\)/);
  assert.match(homePage, /function ResponsiveYouTubeEmbed/);
  assert.match(homePage, /enablejsapi=1/);
  assert.match(homePage, /loadYouTubeIframeApi/);
  assert.match(homePage, /target\.getCurrentTime\(\)/);
  assert.match(homePage, /playerRef\.current\?\.seekTo\(nextTime, allowSeekAhead\)/);
  assert.match(homePage, /\(event\.clientX - bounds\.left\) \/ bounds\.width/);
  assert.match(homePage, /mobile-youtube-controls/);
  assert.match(homePage, /className="mobile-youtube-volume"/);
  assert.match(homePage, /playerRef\.current\?\.setVolume\(safeVolume\)/);
  assert.match(homePage, /event\.currentTarget\.setPointerCapture\(event\.pointerId\)/);
  assert.match(homePage, /onPointerMove=\{\(event\) =>/);
  assert.match(homePage, /return <ResponsiveYouTubeEmbed sermon={sermon} className={className} \/>/);
  assert.match(
    styles,
    /\.featured-sermon-media iframe,[\s\S]*position: absolute;[\s\S]*inset: 0;/,
  );
  assert.doesNotMatch(homePage, /sermon-mobile-youtube-trigger/);
  assert.doesNotMatch(styles, /height: max\(210px, 56\.25vw\)/);
  assert.match(
    styles,
    /\.mobile-youtube-controls\.is-enabled\s*\{[\s\S]*display: flex;[\s\S]*min-height: 34px;/,
  );
  assert.match(styles, /\.featured-sermon-media\.is-ended iframe,[\s\S]*opacity: 0;/);
  assert.match(
    styles,
    /\.video-modal-frame\s*\{[\s\S]*position: relative;[\s\S]*overflow: hidden;/,
  );
});
