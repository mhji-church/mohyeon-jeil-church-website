import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`administrator manually refreshes sermons at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    expect((await request.get("/api/admin/youtube/sync")).status()).toBe(403);
    expect((await request.post("/api/admin/youtube/sync")).status()).toBe(403);
    const websiteLogin = await request.post("/api/admin/session", { data: { username: "browser-admin", password: "browser-admin-password" } });
    expect(websiteLogin.status()).toBe(200);
    expect((await request.get("/api/admin/youtube/sync")).status()).toBe(403);
    expect((await request.post("/api/admin/youtube/sync")).status()).toBe(403);
    const websiteCookie = websiteLogin.headers()["set-cookie"].split(";")[0].split("=");
    await page.context().addCookies([{ name: websiteCookie[0], value: websiteCookie.slice(1).join("="), url: "http://127.0.0.1:4178" }]);
    await page.goto("/admin", { waitUntil: "networkidle" });
    await expect(page.getByRole("region", { name: "설교 재생목록 동기화" })).toHaveCount(0);
    const login = await request.post("/api/admin/session", { data: { username: "browser-archive-admin", password: "browser-archive-password" } });
    expect(login.status()).toBe(200);
    expect((await request.get("/api/admin/youtube/sync")).status()).toBe(200);
    expect((await request.post("/api/admin/youtube/sync", { headers: { origin: "https://other.example" } })).status()).toBe(403);
    const cookie = login.headers()["set-cookie"].split(";")[0].split("=");
    await page.context().addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: "http://127.0.0.1:4178" }]);
    let posts = 0;
    let finish;
    await page.route("**/api/admin/youtube/sync", route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { updatedAt: "2026-11-21 00:10:00" } });
      posts++;
      return new Promise(resolve => { finish = async () => { await route.fulfill({ json: { count: 51, updatedAt: "2026-11-21T01:20:00Z" } }); resolve(); }; });
    });
    await page.goto("/admin", { waitUntil: "networkidle" });
    const panel = page.getByRole("region", { name: "설교 재생목록 동기화" });
    await expect(panel).toContainText("오전 9:10:00");
    expect(posts).toBe(0);
    await panel.getByRole("button", { name: "유튜브 목록 새로고침" }).click();
    await expect(panel.getByRole("button", { name: "새로고침 중…" })).toBeDisabled();
    await expect.poll(() => posts).toBe(1);
    await finish();
    await expect(panel.getByRole("status")).toContainText("영상 51개 반영 완료");
    await expect(panel.getByRole("status")).toContainText("오전 10:20:00");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const button = panel.getByRole("button", { name: "유튜브 목록 새로고침" });
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const bounds = await button.boundingBox();
    expect(bounds.width).toBeLessThan(220);
    expect(bounds.height).toBe(44);
    const notice = await panel.getByRole("status").boundingBox();
    expect(notice.y).toBeGreaterThanOrEqual(bounds.y + bounds.height + 7);
    if (width > 1180) {
      const recent = await page.locator(".admin-home-recent-list").boundingBox();
      const quick = await page.locator(".admin-home-quick-grid > a").last().boundingBox();
      expect(Math.abs(recent.y + recent.height - quick.y - quick.height)).toBeLessThan(1);
      console.log({ bottomDifference: recent.y + recent.height - quick.y - quick.height });
    }
    const workspace = await page.locator(".admin-home-workspace").boundingBox();
    expect(bounds.x + bounds.width).toBeGreaterThan(workspace.x + workspace.width - 40);
    expect(await panel.evaluate(element => element.closest(".admin-home-tools") !== null)).toBe(true);
    console.log({ width, cardWidth: bounds.width, cardHeight: bounds.height });
    await page.screenshot({ path: `test-results/youtube-refresh-${width}.png`, fullPage: true });
    await page.unroute("**/api/admin/youtube/sync");
    await page.route("**/api/admin/youtube/sync", route => route.fulfill({ status: 502, json: { error: "기존 목록은 유지됩니다." } }));
    await button.click();
    await expect(panel.getByRole("status")).toHaveText("기존 목록은 유지됩니다.");
    await expect(button).toBeEnabled();
    await expect(panel).toContainText("오전 10:20:00");
  });
}
