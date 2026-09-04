import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 1000 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
];

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    const expectedLocalCspReport =
      /the policy is report-only/i.test(text) &&
      (/unsafe-eval/i.test(text) || /https:\/\/mhji\.kr\/assets\//i.test(text));
    if (!expectedLocalCspReport && (message.type() === "error" || /content security policy/i.test(text))) {
      errors.push(text);
    }
  });
  return errors;
}

async function expectVisibleImagesToLoad(page) {
  const brokenImages = await page.locator("img:visible").evaluateAll(async (images) => {
    const sourcedImages = images.filter((image) => image.currentSrc || image.getAttribute("src"));
    await Promise.all(sourcedImages.map((image) => {
      if (image.complete) return undefined;
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));
    return sourcedImages
      .filter((image) => image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.getAttribute("src"));
  });
  expect(brokenImages).toEqual([]);
}

for (const viewport of viewports) {
  test(`public main has no overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = watchErrors(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("header").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const hero = page.locator(".hero picture").first();
    await expect(hero).toBeVisible({ timeout: 20_000 });
    await expect(hero.locator('source[media="(max-width: 720px)"]')).toHaveCount(1);
    await expectVisibleImagesToLoad(page);
    if (viewport.width === 390) {
      await page.evaluate(() => document.fonts.ready);
      expect(await page.locator("body").evaluate((body) => getComputedStyle(body).fontFamily)).toContain("Pretendard Archive");
      const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
      expect(resources.some((url) => /assets\/fonts\/pretendard\/.*\.woff2/i.test(url))).toBe(true);
      expect(resources.some((url) => /geist/i.test(url))).toBe(false);
      await expect.poll(
        () => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)),
        { timeout: 10_000 },
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("public content, mobile menu, and pagination remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await page.goto("/");
  const signupNoticeClose = page.getByRole("button", { name: "회원가입 안내 닫기" });
  if (await signupNoticeClose.isVisible()) await signupNoticeClose.click();
  const menuButton = page.getByRole("button", { name: "메뉴 열기" });
  await menuButton.click();
  await expect(page.getByRole("navigation", { name: "모바일 주요 메뉴" })).toBeVisible();
  await page.getByRole("button", { name: "메뉴 닫기" }).click();
  for (const path of ["/bulletin", "/news", "/gallery"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expectVisibleImagesToLoad(page);
  }
  await page.goto("/bulletin");
  await expect(page.getByRole("button", { name: /다음/ }).or(page.getByRole("link", { name: /다음/ })).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("bulletin and news keep the current pagination button legible in every interaction state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const path of ["/bulletin", "/news"]) {
    await page.goto(path);
    const active = page.locator('.public-pagination button[aria-current="page"]');
    const regular = page.locator('.public-pagination-pages button:not([aria-current="page"])').first();
    const previous = page.getByRole("button", { name: "이전" });
    await expect(active).toHaveCount(1);
    await expect(active).toHaveAttribute("aria-current", "page");
    await expect(previous).toBeDisabled();

    const colors = async () => active.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    const selected = await colors();
    await active.hover();
    expect(await colors()).toEqual(selected);
    await active.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(active).toBeFocused();
    expect(await active.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    expect(await colors()).toEqual(selected);
    await active.hover();
    await page.mouse.down();
    expect(await colors()).toEqual(selected);
    await page.mouse.up();

    const regularColors = await regular.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    const disabledColors = await previous.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(regularColors).not.toEqual(selected);
    expect(disabledColors).not.toEqual(selected);

    await page.getByRole("button", { name: "다음" }).click();
    await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}(?:\\?.*)?$`));
    await expect(page.locator('.public-pagination button[aria-current="page"]')).toHaveText("1");
  }
});

test("login, signup, admin guard, and admin authoring work on the temporary database", async ({ page }) => {
  await page.goto("/member/signup");
  await expect(page.getByRole("heading", { name: "회원가입", exact: true })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("아이디").fill("browser-admin");
  await page.getByLabel("비밀번호").fill("browser-admin-password");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/content?section=news&new=1");
  await expect(page.getByRole("heading", { name: /새 교회소식 등록/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "미리보기" })).toBeVisible();

  const activityRequests = [];
  await page.route("**/api/admin/activity?*", async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get("page") || "1");
    activityRequests.push(url.search);
    const start = (requestedPage - 1) * 20;
    const logs = Array.from({ length: Math.max(0, Math.min(20, 21 - start)) }, (_, index) => {
      const number = start + index + 1;
      return { id: `activity-${number}`, actorId: `테스트 관리자 ${number}`, action: "content.update", targetType: "news", targetId: `news-${number}`, metadata: { title: `테스트 기록 ${number}` }, createdAt: "2026-09-04T10:00:00" };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ logs, total: 21 }) });
  });

  await page.goto("/admin/activity");
  await expect(page.getByRole("heading", { name: "활동 기록", exact: true })).toBeVisible();
  const refresh = page.getByRole("button", { name: "목록 새로고침" });
  await expect(refresh).toBeVisible();
  expect(await refresh.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(48, 47, 60)");
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByLabel("활동 기록 검색")).toBeVisible();
    await expect(page.getByLabel("작업 유형 필터")).toBeVisible();
    await expect(refresh).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "2페이지" }).click();
  await expect(page.getByText("테스트 관리자 21")).toBeVisible();
  await page.getByLabel("활동 기록 검색").fill("테스트");
  await page.getByLabel("작업 유형 필터").selectOption("content.create");
  await expect.poll(() => activityRequests.some((search) => search.includes("q=%ED%85%8C%EC%8A%A4%ED%8A%B8") && search.includes("action=content.create"))).toBe(true);
});

test("approved local member can enter the worship archive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchErrors(page);
  await page.goto("/member/login?return_to=%2Farchive");
  await page.getByLabel("이름 또는 기존 아이디").fill("test-member");
  await page.getByLabel("비밀번호").fill("browser-test-password");
  await page.getByRole("button", { name: "교인 로그인" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:4178\/archive(?:[/?#]|$)/);
  await expect(page.getByText("모현제일교회 예배 아카이브").first()).toBeVisible();
  expect(errors).toEqual([]);
});
