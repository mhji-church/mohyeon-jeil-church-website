import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../app/components/KakaoChurchMap.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const homePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("keeps page scrolling ahead of incidental Kakao map gestures", () => {
  assert.match(component, /map\.setZoomable\(enabled\)/);
  assert.match(component, /map\.setDraggable\(enabled\)/);
  assert.match(component, /MAP_SCROLL_IDLE_MS = 650/);
  assert.match(component, /MAP_INTERACTION_TIMEOUT_MS = 5000/);
  assert.match(component, /MAP_TOUCH_INTERACTION_TIMEOUT_MS = 10000/);
  assert.match(
    component,
    /window\.addEventListener\("wheel", handleWindowWheel, \{ capture: true, passive: true \}\)/,
  );
  assert.match(component, /event\.touches\.length < 2/);
  assert.match(component, /지도 움직이기/);
  assert.match(component, /페이지 스크롤로 돌아가기/);
  assert.match(component, /누른 뒤 한 손가락으로 이동/);
  assert.match(component, /touchmove/);
  assert.match(styles, /\.kakao-map-canvas\s*\{[\s\S]*touch-action: pan-y pinch-zoom/);
  assert.match(styles, /\.kakao-map-canvas\[data-interactive="true"\][\s\S]*touch-action: none/);
  assert.match(styles, /\.kakao-map-touch-toggle\s*\{[\s\S]*display: none/);
});

test("removes the duplicate route action inside the map", () => {
  assert.doesNotMatch(component, /KAKAO_ROUTE_LINK/);
  assert.doesNotMatch(component, />\s*길찾기\s*</);
  assert.match(component, />\s*큰 지도 보기\s*</);
});

test("links the directions video from the visit information panel", () => {
  assert.match(homePage, /오시는 길 영상으로 보기/);
  assert.match(
    homePage,
    /https:\/\/www\.youtube\.com\/shorts\/ee2SpzejB6k\?feature=share/,
  );
});
