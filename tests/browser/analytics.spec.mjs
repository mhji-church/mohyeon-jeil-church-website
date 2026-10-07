import { expect, test } from "@playwright/test";
test.setTimeout(120_000);

const emptyMetric = { visitors: 3, visits: 5, pageviews: 12, newVisitors: 2, returningVisitors: 1, pagesPerVisit: 2.4, averageEngagementSeconds: 35, visitorsEstimated: false, historicBreakdownUnavailable: false };
const breakdown = (label, visitors = 2, visits = 3) => [{ label, visitors, visits }];
const mockReport = {
  collectionDay: "2026-10-07", updatedAt: "2026-10-07 KST", range: { start: "2026-10-07", end: "2026-10-07", previousStart: "2026-10-06", previousEnd: "2026-10-06", days: 1 },
  period: "today", grain: "day", precollection: false, coverageStart: "2026-10-07", metrics: emptyMetric, previous: { ...emptyMetric, visitors: 2 },
  trend: [{ bucket: "2026-10-07", visitors: 3, visits: 5, pageviews: 12, estimated: false }],
  pages: [{ label: "/gallery", pageviews: 7, visitors: 2 }], pageChanges: [{ label: "/gallery", current: 7, previous: 5, difference: 2 }],
  actions: [{ kind: "gallery.open", contentType: "gallery", contentId: "local-gallery", title: "가상 갤러리", total: 4 }],
  actionSources: [{ source: "search", kind: "gallery.open", total: 2 }],
  sources: breakdown("search"), domains: breakdown("google.com"), countries: breakdown("ZZ"), devices: breakdown("mobile"), browsers: breakdown("Chrome"), systems: breakdown("Android"), campaigns: breakdown("autumn"), entries: breakdown("/"), exits: breakdown("/gallery"), weekdays: breakdown("2"), hours: breakdown("19"),
};

for (const width of [320, 390, 1440]) {
  test(`private analytics dashboard stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.waitForTimeout(600);
    await page.getByLabel("아이디").fill("browser-archive-admin");
    await page.getByLabel("비밀번호").fill("browser-archive-password");
    await page.getByRole("button", { name: "관리자 로그인" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.route("**/api/admin/analytics?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockReport) }));
    await page.goto("/admin/analytics", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "접속 통계" })).toBeVisible();
    await expect(page.getByText("방문자 수", { exact: true })).toBeVisible();
    await expect(page.getByText("인기 페이지")).toBeVisible();
    await expect(page.getByText("가상 갤러리")).toBeVisible();
    await page.getByRole("button", { name: "이번 주" }).click();
    await expect(page.getByRole("button", { name: "이번 주" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "직접 선택" }).click();
    await expect(page.getByText("시작일과 종료일을 선택해 주세요.")).toBeVisible();
    await page.getByRole("button", { name: "이번 달" }).click();
    await expect(page.getByRole("link", { name: "선택 기간·필터 CSV 다운로드" })).toHaveAttribute("href", /api\/admin\/analytics\/export/);
    const browserDetails = page.locator(".analytics-detail").filter({ has: page.locator("summary", { hasText: "브라우저" }) });
    await browserDetails.locator("summary").click({ noWaitAfter: true });
    await expect(browserDetails.locator("table")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
}

test("website administrator cannot see analytics menu or direct route", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.waitForTimeout(600);
  await page.getByLabel("아이디").fill("browser-admin");
  await page.getByLabel("비밀번호").fill("browser-admin-password");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "접속 통계" })).toHaveCount(0);
  expect((await page.request.get("/api/admin/analytics")).status()).toBe(403);
  expect((await page.request.get("/api/admin/analytics/export")).status()).toBe(403);
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "접속 통계" })).toHaveCount(0);
});
