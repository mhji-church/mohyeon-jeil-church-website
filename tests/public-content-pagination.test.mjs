import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  contentPageForRow,
  normalizeContentPage,
  PUBLIC_CONTENT_PAGE_SIZE,
} from "../lib/public-pagination.ts";

const readSource = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("public content pages clamp invalid, first, middle, and last pages", () => {
  assert.equal(PUBLIC_CONTENT_PAGE_SIZE, 10);
  assert.equal(normalizeContentPage(undefined, 5), 1);
  assert.equal(normalizeContentPage("0", 5), 1);
  assert.equal(normalizeContentPage("-2", 5), 1);
  assert.equal(normalizeContentPage("invalid", 5), 1);
  assert.equal(normalizeContentPage("3", 5), 3);
  assert.equal(normalizeContentPage("99", 5), 5);
  assert.equal(contentPageForRow(1), 1);
  assert.equal(contentPageForRow(10), 1);
  assert.equal(contentPageForRow(11), 2);
  assert.equal(contentPageForRow(50), 5);
});

test("bulletin and news use database pagination and preserve direct-date navigation", () => {
  const content = readSource("../lib/content.ts");
  const bulletin = readSource("../app/bulletin/BulletinBoard.tsx");
  const news = readSource("../app/news/page.tsx");
  const pagination = readSource("../app/components/PublicPagination.tsx");

  assert.match(content, /SELECT COUNT\(\*\) AS count/);
  assert.match(content, /LIMIT \? OFFSET \?/);
  assert.match(content, /ROW_NUMBER\(\) OVER/);
  assert.match(content, /ORDER BY date DESC, sort_order DESC, created_at DESC, id DESC/);
  assert.match(bulletin, /currentPage === 1 \? posts\[0\] : null/);
  assert.match(bulletin, /posts\.slice\(1\)/);
  assert.match(news, /targetDate: selectedDate/);
  assert.match(news, /open=\{selectedId \? post\.date === selectedDate/);
  assert.match(news, /NewsAccordionController enabled=\{!selectedId\}/);
  assert.match(pagination, /new URLSearchParams\(searchParams\.toString\(\)\)/);
  assert.match(pagination, /params\.set\("page"/);
  assert.match(pagination, /params\.delete\("date"\)/);
  assert.match(pagination, /public-pagination-mobile/);
  assert.match(pagination, /scrollIntoView/);
});

test("Pretendard is global and member filters expose interactive cursor states", () => {
  const layout = readSource("../app/layout.tsx");
  const styles = readSource("../app/globals.css");
  const members = readSource("../app/admin/members/AdminMembers.tsx");

  assert.doesNotMatch(layout, /next\/font\/google|Geist|Geist_Mono/);
  assert.match(members, /router\.push\([^;]+, \{ scroll: false \}\)/);
  assert.match(styles, /@font-face[\s\S]*font-family: "Pretendard Archive"[\s\S]*PretendardVariable\.woff2/);
  assert.match(styles, /--font-pretendard:[\s\S]*"Malgun Gothic", sans-serif/);
  assert.match(styles, /body[\s\S]*font-family: var\(--font-pretendard\)/);
  assert.match(styles, /\.admin-member-filters button[\s\S]*cursor: pointer/);
  assert.match(styles, /\.admin-member-filters button:disabled[\s\S]*cursor: not-allowed/);
  assert.match(members, /<button type="button" className=\{filter === key \? "is-active"/);
});
