import { expect, test } from "@playwright/test";
test.setTimeout(120_000);

const emptyMetric = { visitors: 3, visits: 5, pageviews: 12, newVisitors: 2, returningVisitors: 1, pagesPerVisit: 2.4, averageEngagementSeconds: 35, visitorsEstimated: false, historicBreakdownUnavailable: false };
const breakdown = (label, visitors = 2, visits = 3) => [{ label, visitors, visits }];
const mockReport = {
  collectionDay: "2026-10-07", updatedAt: "2026-10-07 KST", range: { start: "2026-10-07", end: "2026-10-07", previousStart: "2026-10-06", previousEnd: "2026-10-06", days: 1 },
  period: "today", grain: "day", precollection: false, coverageStart: "2026-10-07", metrics: emptyMetric, previous: { ...emptyMetric, visitors: 2 },
  trend: [{ bucket: "2026-10-07", visitors: 3, visits: 5, pageviews: 12, estimated: false }],
  pages: [{ label: "/sermons", contentId: "", title: "", pageviews: 7, visitors: 2 }, { label: "/gallery/detail", contentId: "virtual-gallery", title: "가상 갤러리 행사 사진을 함께 돌아보는 긴 제목", pageviews: 1, visitors: 1 }], pageChanges: [{ label: "/sermons", contentId: "", current: 7, previous: 5, difference: 2 }],
  actions: [{ kind: "gallery.open", contentType: "gallery", contentId: "local-gallery", title: "가상 갤러리", total: 4 }],
  actionSources: [{ source: "search", kind: "gallery.open", total: 2 }],
  sources: breakdown("search"), domains: breakdown("google.com"), countries: breakdown("ZZ"), devices: breakdown("mobile"), browsers: breakdown("Chrome"), systems: breakdown("Android"), campaigns: breakdown("autumn"), entries: breakdown("/"), exits: breakdown("/gallery"), weekdays: breakdown("2"), hours: breakdown("19"),
};

for (const width of [320, 390, 760, 820, 1440]) {
  test(`private analytics dashboard stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("아이디").fill("browser-archive-admin");
    await page.getByLabel("비밀번호").fill("browser-archive-password");
    await page.getByRole("button", { name: "관리자 로그인" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    if (width === 390 || width === 1440) {
      await expect(page.getByText("오늘의 접속")).toBeVisible();
      if (width === 390) {
        const cards = page.locator(".admin-home-analytics-grid > div");
        await expect(cards).toHaveCount(3);
        const boxes = await cards.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()));
        expect(boxes.every((box) => box.width > 75 && box.right <= 390 && box.y === boxes[0].y)).toBe(true);
      }
      await page.screenshot({ path: `test-results/analytics-home-${width}.png`, fullPage: true });
    }
    let reportVariant = mockReport;
    await page.route("**/api/admin/analytics?*", (route) => route.fulfill(reportVariant ? { status: 200, contentType: "application/json", body: JSON.stringify(reportVariant) } : { status: 503, contentType: "application/json", body: JSON.stringify({ error: "접속 통계를 불러오지 못했습니다." }) }));
    await page.goto("/admin/analytics", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "접속 통계" })).toBeVisible();
    await expect(page.locator(".analytics-primary-kpis").getByText("방문자 수", { exact: true })).toBeVisible();
    await expect(page.getByText("인기 페이지")).toBeVisible();
    await expect(page.getByText("설교 모음")).toBeVisible();
    await expect(page.getByText("/gallery/detail")).toBeVisible();
    await expect(page.getByText("가상 갤러리 행사 사진을 함께 돌아보는 긴 제목")).toBeVisible();
    await expect(page.getByText("갤러리 상세 열기 · 가상 갤러리", { exact: true })).toBeVisible();
    await expect(page.getByText("통계 수집을 시작했습니다.", { exact: false })).toBeVisible();
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/analytics-dashboard-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "이번 주" }).click();
    await expect(page.getByRole("button", { name: "이번 주" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "직접 선택" }).click();
    await expect(page.getByText("시작일과 종료일을 선택해 주세요.")).toBeVisible();
    await page.getByRole("button", { name: "이번 달" }).click();
    const csv = page.getByRole("link", { name: "선택 기간·필터 CSV 다운로드" });
    if (width <= 760) {
      await expect(csv).toHaveCount(0);
      await page.getByRole("button", { name: /필터/ }).first().click();
      await expect(page.getByRole("combobox", { name: "유입" })).toBeVisible();
      await page.getByRole("combobox", { name: "유입" }).selectOption("search");
      await expect(page.getByRole("button", { name: /필터 1개 적용/ })).toBeVisible();
      await page.getByRole("button", { name: "필터 초기화" }).click();
      await expect(page.getByRole("combobox", { name: "유입" })).toHaveValue("");
    } else await expect(csv).toHaveAttribute("href", /api\/admin\/analytics\/export/);
    const browserDetails = page.locator(".analytics-detail").filter({ has: page.locator("summary", { hasText: "브라우저" }) });
    await browserDetails.locator("summary").click({ noWaitAfter: true });
    await expect(browserDetails.locator("table")).toBeVisible();
    if (width === 390) {
      reportVariant = { ...mockReport, range: { ...mockReport.range, start: "2026-10-06", end: "2026-10-08" }, trend: [
        { bucket: "2026-10-06", visitors: 0, visits: 0, pageviews: 0, estimated: false, precollection: true },
        { bucket: "2026-10-07", visitors: 0, visits: 0, pageviews: 0, estimated: false, precollection: false },
        { bucket: "2026-10-08", visitors: 3, visits: 5, pageviews: 12, estimated: false, precollection: false },
      ] };
      await page.getByRole("button", { name: "통계 새로고침" }).click();
      await expect(page.locator(".analytics-chart-y span")).toHaveCount(5);
      await expect(page.getByRole("button", { name: "2026-10-06: 수집 전" })).toBeVisible();
      await expect(page.getByRole("button", { name: "2026-10-07: 방문자 수 0명" })).toBeVisible();
      await page.getByRole("button", { name: "2026-10-08: 방문자 수 3명" }).focus();
      await expect(page.locator(".analytics-chart-tooltip")).toContainText("방문자 수 3명");
      await page.getByRole("combobox", { name: "표시 지표" }).selectOption("pageviews");
      await expect(page.getByRole("button", { name: "2026-10-08: 페이지 조회수 12회" })).toBeVisible();
      reportVariant = null;
      await page.getByRole("button", { name: "통계 새로고침" }).click();
      await expect(page.getByRole("alert")).toContainText("접속 통계를 불러오지 못했습니다.");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
}

test("website administrator sees analytics menu, home summary and direct route", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("아이디").fill("browser-admin");
  await page.getByLabel("비밀번호").fill("browser-admin-password");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "접속 통계" })).toBeVisible();
  await expect(page.getByText("오늘의 접속")).toBeVisible();
  expect((await page.request.get("/api/admin/analytics")).status()).toBe(200);
  expect((await page.request.get("/api/admin/analytics/export")).status()).toBe(200);
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "접속 통계" })).toBeVisible();
});
