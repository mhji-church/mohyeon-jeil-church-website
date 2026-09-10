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

test("mobile hero keeps the full desktop composition across all five slides", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.addInitScript(() => window.sessionStorage.setItem("mhji-signup-notice-session-dismissed", "1"));
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const hero = page.locator(".hero");
    await expect(hero).toBeVisible();
    const heroSize = await hero.evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(heroSize.width / heroSize.height).toBeCloseTo(16 / 9, 2);

    for (let index = 0; index < 5; index += 1) {
      const activeSlide = page.locator(".hero-slide.is-active");
      await expect(activeSlide).toHaveCount(1);
      const image = activeSlide.locator("img");
      await expect(image).toBeVisible();
      const imageState = await image.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          currentSrc: element.currentSrc,
          naturalRatio: element.naturalWidth / element.naturalHeight,
          boxRatio: bounds.width / bounds.height,
          objectFit: style.objectFit,
        };
      });
      expect(imageState.currentSrc).toMatch(/hero-(?:drone|sign|worship|flowers|winter)-4k\.webp$/);
      expect(imageState.naturalRatio).toBeCloseTo(16 / 9, 2);
      expect(imageState.boxRatio).toBeCloseTo(16 / 9, 2);
      expect(imageState.objectFit).toBe("cover");
      await expect(image).toHaveCSS("animation-name", "heroDriftMobile");
      if (index === 0) {
        const initialScale = await image.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
        await page.waitForTimeout(700);
        const laterScale = await image.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
        expect(laterScale).toBeGreaterThan(initialScale + 0.001);
        expect(laterScale).toBeLessThan(1.026);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await hero.screenshot({ path: `test-results/hero-mobile-${viewport.width}-${index + 1}.png` });
      if (index < 4) {
        await page.getByRole("button", { name: "다음 사진" }).click();
        await expect(page.locator(".hero-counter strong")).toHaveText(String(index + 2).padStart(2, "0"));
        await page.waitForTimeout(900);
      }
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".hero-slide.is-active img")).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(errors).toEqual([]);
});

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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/member/signup");
  await expect(page.getByRole("heading", { name: "회원가입", exact: true })).toBeVisible();
  await expect(page.getByText("소속이 있다면 ‘집사 / 남전도회’처럼 입력해 주세요.")).toBeVisible();
  await expect(page.getByLabel("직분 또는 소속 부서 선택")).toHaveAttribute("aria-describedby", "signup-position-help");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("아이디").fill("browser-admin");
  await page.getByLabel("비밀번호").fill("browser-admin-password");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "아카이브 관리" })).toHaveCount(0);
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

test("archive mobile worship titles stay on one accessible line", async ({ page }) => {
  const exampleTitle = "2026년 9월 6일 주일 2부 예배";
  const longTitle = `${exampleTitle} 온 가족이 함께 드리는 감사와 찬양의 특별예배`;
  const videos = [exampleTitle, longTitle].map((title, index) => ({
    id: `mobile-title-${index + 1}`,
    type: "worship",
    date: "2026-09-06",
    serviceType: "주일 2부 예배",
    title,
    preacher: "담임목사",
    durationSeconds: 3600,
    note: "",
    createdAt: "",
    updatedAt: "",
    analysis: null,
  }));
  const otherTitle = "2026년 9월 9일 수요예배";
  const otherVideos = [{ ...videos[0], id: "mobile-title-other", date: "2026-09-09", serviceType: "수요예배", title: otherTitle }];
  let homeFeaturedTitle = exampleTitle;
  const getHomeVideos = () => [
    { ...videos[0], title: homeFeaturedTitle },
    { ...videos[0], id: "mobile-title-attendance", type: "attendance", serviceType: "출석 기록", title: "출석 교인", preacher: "" },
  ];
  await page.route("**/api/archive/videos?*", (route) => {
    const group = new URL(route.request().url()).searchParams.get("group");
    const selectedVideos = group === "other" ? otherVideos : group === "sunday" ? videos : getHomeVideos();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ videos: selectedVideos, total: selectedVideos.length, page: 1, pageSize: 8 }) });
  });
  await page.route("**/api/archive/videos/mobile-title-*/thumbnail", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#312f3d"/></svg>',
  }));
  await page.route("**/api/archive/videos/mobile-title-*/playback", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const video = [...videos, ...otherVideos, ...getHomeVideos()].find((item) => item.id === id) ?? videos[0];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ video, embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, note: "" }) });
  });
  await page.route("https://www.youtube-nocookie.com/embed/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>로컬 영상 플레이어</title>" }));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/member/login?return_to=%2Farchive%2Fsunday");
  await expect.poll(() => page.locator(".member-login-form").evaluate((form) =>
    Object.keys(form).some((key) => key.startsWith("__reactProps")),
  ), { timeout: 20_000 }).toBe(true);
  await page.getByLabel("이름 또는 기존 아이디").fill("test-member");
  await page.getByLabel("비밀번호").fill("browser-test-password");
  await page.getByRole("button", { name: "교인 로그인" }).click();
  await expect(page).toHaveURL(/\/archive\/sunday$/);
  const cards = page.locator(".list-media-grid .media-card--worship");
  await expect(cards).toHaveCount(2);
  const example = cards.nth(0).locator("h3");
  const long = cards.nth(1).locator("h3");
  await expect(example).toHaveAttribute("aria-label", exampleTitle);
  await expect(long).toHaveAttribute("aria-label", longTitle);
  await expect(cards.nth(0).locator(".media-date")).toBeHidden();
  await expect(cards.nth(1).locator(".media-date")).toBeVisible();
  for (const heading of [example, long]) {
    await expect(heading).toHaveCSS("white-space", "nowrap");
    await expect(heading).toHaveCSS("text-overflow", "ellipsis");
  }
  const placement = await cards.nth(0).evaluate((card) => {
    const thumbnail = card.querySelector(".media-thumb")?.getBoundingClientRect();
    const heading = card.querySelector("h3")?.getBoundingClientRect();
    const preacher = card.querySelector(".media-meta p")?.getBoundingClientRect();
    return { thumbnailRight: thumbnail?.right ?? 0, headingLeft: heading?.left ?? 0, headingBottom: heading?.bottom ?? 0, preacherTop: preacher?.top ?? 0 };
  });
  expect(placement.headingLeft).toBeGreaterThanOrEqual(placement.thumbnailRight);
  expect(placement.preacherTop).toBeGreaterThanOrEqual(placement.headingBottom);
  expect(await example.locator(".media-title-button").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await long.locator(".media-title-button").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const exampleTitleButton = cards.nth(0).locator(".media-title-button");
  await exampleTitleButton.focus();
  await exampleTitleButton.press("Enter");
  await expect(page.locator(".viewer-backdrop")).toHaveCount(1);
  await expect(page.locator(".viewer-backdrop")).toBeVisible();
  await page.locator(".viewer-backdrop").getByRole("button", { name: "닫기" }).click();
  await expect(exampleTitleButton).toBeFocused();
  const longTitleButton = cards.nth(1).locator(".media-title-button");
  await longTitleButton.press("Space");
  await expect(page.locator(".viewer-backdrop")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(longTitleButton).toBeFocused();

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(example).toHaveCSS("white-space", "nowrap");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.goto("/archive/other");
  const otherCard = page.locator(".list-media-grid .media-card--worship");
  await expect(otherCard).toHaveCount(1);
  await expect(otherCard.locator("h3")).toHaveAttribute("title", otherTitle);
  await expect(otherCard.locator(".media-date")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 820, height: 1000 });
  await expect(otherCard.locator("h3")).not.toHaveCSS("white-space", "nowrap");
  await expect(otherCard.locator(".media-date")).toBeVisible();
  const tabletTitleButton = otherCard.locator(".media-title-button");
  await tabletTitleButton.click();
  await expect(page.locator(".viewer-backdrop")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tabletTitleButton).toBeFocused();

  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/archive");
    await expect(page.locator(".recent-section .media-card")).toHaveCount(2);
    await expect(page.locator(".recent-section .media-card--worship .media-thumb")).toBeVisible();
    await expect(page.locator(".recent-section .media-card:not(.media-card--worship) .media-thumb")).toBeVisible();
    const dimensions = await page.locator(".recent-section").evaluate((section) => {
      const worship = section.querySelector(".media-card--worship .media-thumb")?.getBoundingClientRect();
      const attendance = section.querySelector(".media-card:not(.media-card--worship) .media-thumb")?.getBoundingClientRect();
      const worshipMeta = section.querySelector(".media-card--worship .media-meta")?.getBoundingClientRect();
      return {
        worship: { width: worship?.width ?? 0, height: worship?.height ?? 0 },
        attendance: { width: attendance?.width ?? 0, height: attendance?.height ?? 0 },
        textWidth: worshipMeta?.width ?? 0,
      };
    });
    expect(Math.abs(dimensions.worship.width - dimensions.attendance.width)).toBeLessThan(0.5);
    expect(Math.abs(dimensions.worship.height - dimensions.attendance.height)).toBeLessThan(0.5);
    expect(dimensions.worship.width / dimensions.worship.height).toBeCloseTo(16 / 9, 2);
    expect(dimensions.textWidth).toBeGreaterThan(100);
    await expect(page.locator(".recent-section .media-card--worship h3")).toHaveCSS("white-space", "nowrap");
    const featuredHeading = page.locator(".featured-copy h1");
    await expect(featuredHeading).toHaveAttribute("aria-label", exampleTitle);
    await expect(featuredHeading).toHaveAttribute("title", exampleTitle);
    await expect(featuredHeading).toHaveCSS("white-space", "nowrap");
    expect(Number.parseFloat(await featuredHeading.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18);
    expect(await featuredHeading.evaluate((element) => {
      const style = getComputedStyle(element);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return false;
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = element.textContent ?? "";
      const textWidth = context.measureText(text).width + Number.parseFloat(style.letterSpacing || "0") * Math.max(0, text.length - 1);
      return textWidth <= element.clientWidth + 0.5;
    })).toBe(true);
    if (viewport.width === 390) {
      const featuredTitleButton = page.locator(".featured-copy .featured-title-button");
      await featuredTitleButton.click();
      await expect(page.locator(".viewer-backdrop")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(featuredTitleButton).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/archive/sunday");
  const desktopTitleButton = page.locator(".list-media-grid .media-card .media-title-button").first();
  await desktopTitleButton.click();
  await expect(page.locator(".viewer-backdrop")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(desktopTitleButton).toBeFocused();

  homeFeaturedTitle = longTitle;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/archive?featured=long-title-test");
  const longFeaturedHeading = page.locator(".featured-copy h1");
  await expect(longFeaturedHeading).toHaveText(longTitle);
  await expect(longFeaturedHeading).toHaveAttribute("aria-label", longTitle);
  await expect(longFeaturedHeading).toHaveAttribute("title", longTitle);
  await expect(longFeaturedHeading).toHaveCSS("text-overflow", "ellipsis");
  expect(await longFeaturedHeading.evaluate((element) => {
    const style = getComputedStyle(element);
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return false;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = element.textContent ?? "";
    const textWidth = context.measureText(text).width + Number.parseFloat(style.letterSpacing || "0") * Math.max(0, text.length - 1);
    return textWidth > element.clientWidth + 0.5;
  })).toBe(true);
});

test("song history keeps its state while the shared video viewer opens above it", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  page.on("response", (response) => {
    if (response.status() === 404) errors.push(`404 ${response.url()}`);
  });
  const history = Array.from({ length: 18 }, (_, index) => ({
    videoId: `song-history-video-${index + 1}`,
    date: `2026-08-${String(18 - index).padStart(2, "0")}`,
    serviceType: index % 2 ? "주일 1부 예배" : "주일 2부 예배",
    videoTitle: `찬양 이력 예배 영상 ${index + 1}`,
    order: (index % 4) + 1,
  }));
  await page.route("**/api/archive/songs/stats?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      summary: { worshipCount: 18, songCount: 1, usageCount: 18, topSong: "브라우저 찬양" },
      rankings: [{ rank: 1, id: "browser-song", displayTitle: "브라우저 찬양", baseTitle: "브라우저 찬양", aliases: [], totalCount: 18, sunday1Count: 9, sunday2Count: 9, wednesdayCount: 0, lastUsed: "2026-08-18" }],
      stale: [],
    }),
  }));
  await page.route("**/api/archive/songs/browser-song/history?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ history }) }));
  await page.route("**/api/archive/videos/song-history-video-*/playback", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    const item = history.find((entry) => entry.videoId === id);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      note: `재생 확인 ${id}`,
      video: { id, type: "worship", date: item.date, serviceType: item.serviceType, title: item.videoTitle, preacher: "담임목사", durationSeconds: 3600, note: `재생 확인 ${id}`, createdAt: "", updatedAt: "", analysis: null },
    }) });
  });
  await page.route("https://www.youtube-nocookie.com/embed/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>로컬 영상 플레이어</title><button>재생 중</button>" }));
  await page.route("**/api/archive/videos/song-history-video-*/thumbnail", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#312f3d"/></svg>',
  }));

  await page.goto("/member/login?return_to=%2Farchive%2Fsongs");
  await expect.poll(() => page.locator(".member-login-form").evaluate((form) =>
    Object.keys(form).some((key) => key.startsWith("__reactProps")),
  ), { timeout: 20_000 }).toBe(true);
  await page.getByLabel("이름 또는 기존 아이디").fill("test-member");
  await page.getByLabel("비밀번호").fill("browser-test-password");
  await page.getByRole("button", { name: "교인 로그인" }).click();
  await expect(page).toHaveURL(/\/archive\/songs$/);
  await expect.poll(() => page.locator(".song-stats-page").evaluate((section) =>
    Object.keys(section).some((key) => key.startsWith("__reactProps")),
  ), { timeout: 20_000 }).toBe(true);
  await page.getByLabel("예배 종류").selectOption("sunday2");
  await page.getByPlaceholder("대표 제목·별칭 검색").fill("브라우저");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await page.getByLabel("오래된 찬양 정렬").selectOption("recent");

  for (const viewport of [{ width: 1440, height: 700 }, { width: 390, height: 640 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    const songButton = page.getByRole("button", { name: "브라우저 찬양" });
    await songButton.click();
    const historyDialog = page.locator(".song-history-backdrop");
    const historyModal = page.locator(".song-history-modal");
    await expect(historyDialog).toBeVisible();
    await expect(page).toHaveURL(/\/archive\/songs\?/);
    if (viewport.width <= 390) {
      const firstHistoryItem = page.locator(".song-history-list article").first();
      const mobileLayout = await firstHistoryItem.evaluate((article) => {
        const date = article.querySelector("time")?.getBoundingClientRect();
        const service = article.querySelector(".song-history-copy strong")?.getBoundingClientRect();
        const title = article.querySelector(".song-history-copy span")?.getBoundingClientRect();
        const actions = article.querySelector(".song-history-actions")?.getBoundingClientRect();
        const button = article.querySelector(".song-history-video-button")?.getBoundingClientRect();
        return { dateText: article.querySelector("time")?.textContent, date, service, title, actions, button, overflow: article.scrollWidth - article.clientWidth };
      });
      expect(mobileLayout.dateText).toBe("2026.08.18");
      expect(Math.abs((mobileLayout.date?.top ?? 0) - (mobileLayout.service?.top ?? 0))).toBeLessThan(3);
      expect(mobileLayout.title?.top ?? 0).toBeGreaterThanOrEqual((mobileLayout.date?.bottom ?? 0) - 1);
      expect(mobileLayout.actions?.top ?? 0).toBeGreaterThanOrEqual((mobileLayout.title?.bottom ?? 0) - 1);
      expect(mobileLayout.button?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(mobileLayout.button?.right ?? 0).toBeGreaterThan(mobileLayout.actions?.left ?? 0);
      expect(mobileLayout.overflow).toBeLessThanOrEqual(0);
      await historyModal.screenshot({ path: `test-results/song-history-mobile-${viewport.width}.png` });
    }
    await historyModal.evaluate((element) => { element.scrollTop = Math.floor(element.scrollHeight / 2); });

    const videoButtons = page.getByRole("button", { name: "영상 보기" });
    for (let index = 6; index < 9; index += 1) {
      const trigger = videoButtons.nth(index);
      await trigger.scrollIntoViewIfNeeded();
      const scrollBefore = await historyModal.evaluate((element) => element.scrollTop);
      await trigger.click();
      const viewer = page.locator(".viewer-backdrop.is-layered");
      await expect(viewer).toBeVisible();
      await expect(viewer.getByRole("heading", { name: history[index].videoTitle })).toBeVisible();
      await expect(historyDialog).toHaveAttribute("inert", "");
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".viewer-modal")))).toBe(true);
      expect(await page.locator(".viewer-player iframe").getAttribute("src")).toContain(history[index].videoId);

      if (index === 6) await viewer.getByRole("button", { name: "닫기" }).click();
      else if (index === 7) await page.keyboard.press("Escape");
      else await viewer.click({ position: { x: 4, y: 4 } });
      await expect(viewer).not.toBeVisible();
      await expect(historyDialog).toBeVisible();
      await expect.poll(() => historyModal.evaluate((element, before) => Math.abs(element.scrollTop - before), scrollBefore)).toBeLessThan(3);
      await expect(trigger).toBeFocused();
      await expect(page.locator(".viewer-player iframe")).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    }

    const backTrigger = videoButtons.nth(8);
    await backTrigger.click();
    await expect(page.locator(".viewer-backdrop.is-layered")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".viewer-backdrop.is-layered")).not.toBeVisible();
    await expect(historyDialog).toBeVisible();
    await page.goBack();
    await expect(historyDialog).not.toBeVisible();
    await expect(songButton).toBeFocused();
    await expect(page.getByPlaceholder("대표 제목·별칭 검색")).toHaveValue("브라우저");
    await expect(page.getByLabel("예배 종류")).toHaveValue("sunday2");
    await expect(page.getByLabel("오래된 찬양 정렬")).toHaveValue("recent");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  }

  await page.route("**/api/archive/videos?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ videos: [{ id: history[0].videoId, type: "worship", date: history[0].date, serviceType: history[0].serviceType, title: history[0].videoTitle, preacher: "담임목사", durationSeconds: 3600, note: "", createdAt: "", updatedAt: "", analysis: null }], total: 1, page: 1, pageSize: 8 }) }));
  await page.goto(`/archive/sunday?video=${history[0].videoId}`);
  await expect(page.locator(".viewer-backdrop")).toBeVisible();
  await expect(page.locator(".viewer-backdrop").getByRole("heading", { name: history[0].videoTitle })).toBeVisible();
  await page.locator(".viewer-backdrop").getByRole("button", { name: "닫기" }).click();
  await expect(page.locator(".viewer-backdrop")).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("archive admin navigation stays responsive above the edit drawer and recovers member loading", async ({ page }) => {
  const errors = watchErrors(page);
  let memberAttempts = 0;
  await page.route("**/api/admin/archive/access", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    memberAttempts += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (memberAttempts === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "임시 회원 조회 오류" }) });
      return;
    }
    const members = Array.from({ length: 28 }, (_, index) => ({ id: index === 0 ? "browser-member" : `browser-member-${index + 1}`, name: index === 0 ? "브라우저테스트" : `브라우저테스트 ${index + 1}`, username: index === 0 ? "test-member" : `test-member-${index + 1}`, status: "approved", accessLevel: "full", songStatsAllowed: true }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ members }) });
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await page.goto("/admin");
    if ((response?.status() ?? 500) < 500) break;
  }
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect.poll(() => page.locator(".admin-login-form").evaluate((form) =>
    Object.keys(form).some((key) => key.startsWith("__reactProps")),
  )).toBe(true);
  await page.getByLabel("아이디").fill("browser-archive-admin");
  await page.getByLabel("비밀번호").fill("browser-archive-password");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "운영 현황" })).toBeVisible();
  const adminNavigation = page.locator(".admin-sidebar nav");
  for (const label of ["관리자 홈", "주보 관리", "교회소식 관리", "갤러리 관리", "성도사업장 관리", "회원 관리", "활동 기록"]) {
    await expect(adminNavigation.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }
  const archiveLink = page.locator('.admin-sidebar nav a[href="/archive/admin"]');
  await expect(archiveLink).toBeVisible();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "운영 현황" })).toBeVisible();
    await expect(archiveLink).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await archiveLink.click();
  await expect(page).toHaveURL(/\/archive\/admin$/);
  await expect(page.getByText("브라우저 아카이브 영상")).toBeVisible();

  await page.getByRole("button", { name: "수정" }).click();
  const editor = page.getByRole("dialog", { name: "영상 수정" });
  await editor.getByLabel("영상 제목").fill("저장하지 않은 영상 제목");
  const homepageLink = page.getByRole("link", { name: "홈페이지 관리" });
  await expect(homepageLink).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("저장하지 않은 변경");
    await dialog.dismiss();
  });
  await homepageLink.click();
  await expect(editor).toBeVisible();
  await expect(page).toHaveURL(/\/archive\/admin$/);

  page.once("dialog", async (dialog) => dialog.accept());
  await homepageLink.click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "운영 현황" })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
  const returnToArchiveLink = page.locator('.admin-sidebar nav a[href="/archive/admin"]');
  await returnToArchiveLink.click();
  await expect(page).toHaveURL(/\/archive\/admin$/);
  await expect(page.getByRole("heading", { name: "영상 관리", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "운영 현황" })).toBeVisible();
  await returnToArchiveLink.click();
  await expect(page).toHaveURL(/\/archive\/admin$/);

  await page.getByRole("button", { name: "수정" }).click();
  const reopenedEditor = page.getByRole("dialog", { name: "영상 수정" });
  await reopenedEditor.getByLabel("영상 제목").fill("저장하지 않은 영상 제목");
  const membersLink = page.getByRole("link", { name: "회원 관리" });

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("저장하지 않은 변경");
    await dialog.dismiss();
  });
  await membersLink.click();
  await expect(reopenedEditor).toBeVisible();
  await expect(page).toHaveURL(/\/archive\/admin$/);

  page.once("dialog", async (dialog) => dialog.accept());
  await membersLink.click();
  await expect(page).toHaveURL(/\/archive\/admin\?tab=access$/);
  await expect(page.getByRole("status")).toContainText("회원 목록을 불러오는 중");
  await expect(page.getByRole("alert")).toContainText("임시 회원 조회 오류");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("status")).toContainText("회원 목록을 불러오는 중");
  await expect(page.getByText("브라우저테스트", { exact: true })).toBeVisible();
  expect(memberAttempts).toBe(2);

  const archiveSidebar = page.locator(".cms-sidebar");
  const homepageManagementLink = page.getByRole("link", { name: "홈페이지 관리" });
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(archiveSidebar).toHaveCSS("position", "fixed");
  const sidebarTop = (await archiveSidebar.boundingBox()).y;
  const homepageTop = (await homepageManagementLink.boundingBox()).y;
  await page.evaluate(() => window.scrollTo(0, Math.floor(document.documentElement.scrollHeight / 2)));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(Math.abs((await archiveSidebar.boundingBox()).y - sidebarTop)).toBeLessThan(2);
  expect(Math.abs((await homepageManagementLink.boundingBox()).y - homepageTop)).toBeLessThan(2);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(Math.abs((await archiveSidebar.boundingBox()).y - sidebarTop)).toBeLessThan(2);
  expect(Math.abs((await homepageManagementLink.boundingBox()).y - homepageTop)).toBeLessThan(2);

  await page.setViewportSize({ width: 1440, height: 360 });
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await archiveSidebar.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await archiveSidebar.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(homepageManagementLink).toBeVisible();
  const smallHeaderBox = await page.locator(".cms-header").boundingBox();
  const smallHomepageBox = await homepageManagementLink.boundingBox();
  expect(smallHomepageBox.y).toBeGreaterThanOrEqual(smallHeaderBox.y + smallHeaderBox.height);
  expect(smallHomepageBox.y + smallHomepageBox.height).toBeLessThanOrEqual(361);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(archiveSidebar).toHaveCSS("position", "relative");
  await expect(homepageManagementLink).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const videosLink = page.getByRole("link", { name: "영상 관리" });
  const settingsLink = page.getByRole("link", { name: "설정", exact: true });
  const adminLogo = page.getByRole("link", { name: "모현제일교회 예배 아카이브 홈" });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(membersLink).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await videosLink.click();
      await expect(page).toHaveURL(/\/archive\/admin$/);
      await expect(page.getByRole("heading", { name: "영상 관리", exact: true })).toBeVisible();
      await membersLink.click();
      await expect(page).toHaveURL(/\/archive\/admin\?tab=access$/);
      await expect(page.getByRole("heading", { name: "회원 관리", exact: true })).toBeVisible();
    }
    await videosLink.click();
    await membersLink.dblclick();
    await expect(page).toHaveURL(/\/archive\/admin\?tab=access$/);
    await expect(page.getByText("브라우저테스트", { exact: true })).toBeVisible();

    await adminLogo.click();
    await expect(page).toHaveURL(/\/archive\/admin$/);
    await expect(page.getByRole("heading", { name: "영상 관리", exact: true })).toBeVisible();
    await settingsLink.click();
    await expect(page).toHaveURL(/\/archive\/admin\?tab=settings$/);
    await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
    await adminLogo.click();
    await expect(page).toHaveURL(/\/archive\/admin$/);
    await expect(page.getByRole("heading", { name: "영상 관리", exact: true })).toBeVisible();

    await membersLink.click();
    await expect(page).toHaveURL(/\/archive\/admin\?tab=access$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/archive\/admin$/);
    await expect(page.getByRole("heading", { name: "영상 관리", exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/member\/login\?return_to=%2Farchive$/);
  await page.goto("/archive/admin");
  await expect(page).toHaveURL(/\/admin\/login\?return_to=/);
  expect(errors.filter((error) => !/status of 503|503 \(Service Unavailable\)/.test(error))).toEqual([]);
});

test("admin member duplicates stay clear and require a fresh server confirmation", async ({ page }) => {
  const errors = watchErrors(page);
  const duplicateCheck = {
    matchedFields: ["phone", "birthDate"],
    fingerprint: "existing-member:phone+birthDate",
    matches: [{
      id: "existing-member",
      name: "기존 가상회원",
      username: "existing-user",
      status: "approved",
      createdAt: "2026-08-20T00:00:00.000Z",
      matchedFields: ["phone", "birthDate"],
    }],
  };
  let approved = false;
  const members = Array.from({ length: 12 }, (_, index) => ({
    id: index === 0 ? "duplicate-pending" : `unique-member-${index}`,
    name: index === 0 ? "중복 의심회원" : `일반 가상회원 ${index}`,
    username: index === 0 ? "duplicate-user" : `unique-user-${index}`,
    phone: index === 0 ? "010-1234-5678" : `010-9000-${String(1000 + index)}`,
    birthDate: index === 0 ? "1980-05-05" : "",
    position: "집사",
    status: index === 0 && !approved ? "pending" : "approved",
    forcePasswordChange: false,
    approvedAt: null,
    approvedBy: null,
    lastLoginAt: null,
    createdAt: `2026-09-${String(10 - Math.min(index, 9)).padStart(2, "0")}T00:00:00.000Z`,
    updatedAt: "2026-09-10T00:00:00.000Z",
    duplicateCheck: index === 0 ? duplicateCheck : null,
  }));
  await page.route("**/api/admin/members**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET") {
      if (url.searchParams.get("summary") === "pending") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pendingCount: approved ? 0 : 1 }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ members, duplicateCount: 1 }) });
    }
    if (request.method() === "PATCH") {
      const payload = request.postDataJSON();
      if (payload?.member?.status === "approved" && payload.duplicateFingerprint !== duplicateCheck.fingerprint) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, requiresDuplicateConfirmation: true, error: "중복 가입 가능성을 확인한 뒤 다시 승인해 주세요.", duplicateCheck }) });
      }
      approved = true;
      members[0].status = "approved";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    return route.continue();
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/login?return_to=%2Fadmin%2Fmembers");
  await expect.poll(() => page.locator(".admin-login-form").evaluate((form) =>
    Object.keys(form).some((key) => key.startsWith("__reactProps")),
  )).toBe(true);
  await page.getByLabel("아이디").fill("browser-admin");
  await page.getByLabel("비밀번호").fill("browser-admin-password");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/admin\/members$/);
  await expect(page.getByRole("button", { name: /중복 가입자 1명/ })).toBeVisible();
  const duplicateBadge = page.locator(".admin-duplicate-badge");
  await expect(duplicateBadge).toHaveText("중복 가입");
  await page.screenshot({ path: "test-results/admin-members-duplicates-list-desktop-1440.png" });
  await duplicateBadge.click();
  const detailDialog = page.getByRole("dialog", { name: "중복 가입 상세" });
  await expect(detailDialog).toContainText("기존 가상회원");
  await expect(detailDialog).toContainText("existing-user");
  await expect(detailDialog).toContainText("승인");
  await expect(detailDialog).toContainText("2026.08.20");
  await expect(detailDialog).toContainText("휴대폰·생년월일 일치");
  await page.screenshot({ path: "test-results/admin-members-duplicates-desktop-1440.png" });
  await detailDialog.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "중복 가입", exact: true }).click();
  await expect(page.locator(".admin-members-table tbody tr")).toHaveCount(1);
  await page.locator(".admin-members-table tbody tr").getByRole("button", { name: "승인", exact: true }).click();
  const approvalDialog = page.getByRole("alertdialog", { name: "중복 가입 승인 확인" });
  await expect(approvalDialog).toContainText("기존 가상회원");
  await expect(approvalDialog).toContainText("휴대폰·생년월일 일치");
  await approvalDialog.getByRole("button", { name: "확인 후 승인" }).click();
  await expect(approvalDialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("승인했습니다");

  approved = false;
  members[0].status = "pending";
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".admin-duplicate-badge")).toBeVisible();
  await page.locator(".admin-duplicate-badge").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/admin-members-duplicates-list-mobile-390.png" });
  await page.locator(".admin-duplicate-badge").click();
  await expect(page.getByRole("dialog", { name: "중복 가입 상세" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/admin-members-duplicates-mobile-390.png" });
  expect(errors).toEqual([]);
});

test("website administrator keeps the full dashboard without archive management", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/admin");
  await page.getByLabel("아이디").fill("browser-admin");
  await page.getByLabel("비밀번호").fill("browser-admin-password");
  await page.getByRole("button", { name: "관리자 로그인" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const websiteMenuLabels = ["관리자 홈", "주보 관리", "교회소식 관리", "갤러리 관리", "성도사업장 관리", "회원 관리", "활동 기록"];
  const websiteNavigation = page.locator(".admin-sidebar nav");
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "운영 현황" })).toBeVisible();
    for (const label of websiteMenuLabels) {
      await expect(websiteNavigation.getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
    await expect(page.locator('.admin-sidebar nav a[href="/archive/admin"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  expect((await page.request.get("/api/admin/members")).status()).toBe(200);
  expect((await page.request.get("/api/admin/archive/videos")).status()).toBe(403);
  await page.goto("/archive/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "로그아웃" }).click();
  await page.goto("/archive/admin");
  await expect(page).toHaveURL(/\/admin\/login\?return_to=/);
  expect(errors).toEqual([]);
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
  await expect(page.getByRole("link", { name: "브라우저테스트 집사 회원 메뉴" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator(".header-member-login.is-member")).toHaveText(/브라우저테스트 집사/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.locator(".mobile-member-login.is-member")).toHaveText(/브라우저테스트 집사/);
  await expect(page.getByText("미디어팀", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
