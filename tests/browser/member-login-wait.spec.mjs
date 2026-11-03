import { expect, test } from "@playwright/test";

const start = new Date("2026-11-03T03:00:00Z");
async function openLogin(page) {
  await page.goto("/member/login", { waitUntil: "networkidle" });
  // Confirm hydration through the existing password-visibility control before
  // pausing timers, so an unhydrated native form submit cannot fake the test.
  // Streamed SSR can be network-idle before its client component hydrates.
  // Wait for the observable toggle result instead of losing the first click.
  await expect.poll(async () => {
    const type = await page.getByLabel("비밀번호").getAttribute("type");
    if (type === "text") return type;
    await page.getByRole("button", { name: "보기", exact: true }).click();
    return page.getByLabel("비밀번호").getAttribute("type");
  }, { timeout: 10_000 }).toBe("text");
  await expect(page.getByLabel("비밀번호")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "숨기기", exact: true }).click();
  await expect(page.getByLabel("비밀번호")).toHaveAttribute("type", "password");
}
async function freezeClock(page) {
  await page.clock.pauseAt(new Date(start.getTime() + 60_000));
  await page.clock.setSystemTime(start);
}
const credentials = async page => {
  await page.getByLabel("이름 또는 기존 아이디").fill("virtual-countdown-user");
  await page.getByLabel("비밀번호").fill("virtual-wrong-password");
};

for (const width of [320, 390, 1440]) {
  test(`member login countdown is deadline based and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    await page.clock.install({ time: new Date(start.getTime() - 1000) });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let requests = 0;
    await page.route("**/api/members/session", route => {
      requests += 1;
      return route.fulfill(requests === 5
        ? { status: 429, headers: { "Retry-After": "299" }, json: { error: "로그인 시도가 많아 일시적으로 제한되었습니다." } }
        : { status: 401, json: { error: "로그인 정보를 확인하거나 관리자 승인 여부를 확인해 주세요." } });
    });
    await openLogin(page);
    await freezeClock(page);
    await credentials(page);
    const form = page.locator(".member-login-form");
    const button = form.locator('button[type="submit"]');
    const message = form.locator(".member-form-error");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await button.click();
      if (attempt < 5) await expect(message).toHaveText("로그인 정보를 확인하거나 관리자 승인 여부를 확인해 주세요.");
      await expect(form).toHaveAttribute("aria-busy", "false");
    }
    await expect(button).toBeDisabled();
    await expect(button).toHaveText("다시 시도까지 04:59");
    await expect(message).toHaveText("로그인 시도가 많아 일시적으로 제한되었습니다. 4분 59초 후 다시 시도해 주세요.");
    await expect(message).toHaveAttribute("aria-live", "off");
    const announcement = await form.getByRole("status").textContent();
    const accessibleButtonName = await button.getAttribute("aria-label");
    await page.screenshot({ path: `test-results/member-login-wait-${width}.png`, fullPage: true });
    await page.clock.runFor(1000);
    await expect(button).toHaveText("다시 시도까지 04:58");
    await expect(form.getByRole("status")).toHaveText(announcement);
    await expect(button).toHaveAttribute("aria-label", accessibleButtonName);
    await form.evaluate(element => element.requestSubmit());
    expect(requests).toBe(5);

    // No interval callbacks run during this clock jump (sleep/background tab).
    await page.clock.setSystemTime(new Date(start.getTime() + 240_000));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(button).toHaveText("다시 시도까지 00:59");
    await page.clock.setSystemTime(new Date(start.getTime() + 300_000));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(button).toBeEnabled();
    await expect(button).toHaveText("교인 로그인");
    await expect(message).toHaveText("다시 로그인할 수 있습니다. 입력 정보를 확인해 주세요.");
    expect(requests).toBe(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await button.click();
    await expect(message).toContainText("로그인 정보를 확인");
    expect(requests).toBe(6);
    expect(errors).toEqual([]);
  });
}

test("member login honors an existing fifteen-minute Retry-After rather than capping it at five", async ({ page }) => {
  await page.clock.install({ time: new Date(start.getTime() - 1000) });
  let requests = 0;
  await page.route("**/api/members/session", route => {
    requests += 1;
    return route.fulfill({ status: 429, headers: { "Retry-After": "900" }, json: { error: "기존 차단" } });
  });
  await openLogin(page);
  await freezeClock(page);
  await credentials(page);
  const button = page.locator('.member-login-form button[type="submit"]');
  await button.click();
  await expect(button).toHaveText("다시 시도까지 15:00");
  await expect(button).toBeDisabled();
  await page.clock.setSystemTime(new Date(start.getTime() + 900_001));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(button).toBeEnabled();
  expect(requests).toBe(1);
});

test("member login keeps password errors, service failures and connection failures distinct", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/members/session", route => {
    requests += 1;
    if (requests === 3) return route.abort("failed");
    return route.fulfill(requests === 1
      ? { status: 401, json: { error: "로그인 정보를 확인하거나 관리자 승인 여부를 확인해 주세요." } }
      : { status: 503, json: { error: "로그인 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요." } });
  });
  await openLogin(page);
  await credentials(page);
  const button = page.getByRole("button", { name: "교인 로그인", exact: true });
  for (const message of ["로그인 정보를 확인", "로그인 시스템에 일시적인 문제", "로그인 서버에 연결할 수 없습니다"]) {
    await button.click();
    await expect(page.locator(".member-form-error")).toContainText(message);
    await expect(button).toBeEnabled();
  }
});

test("native member form submission never puts credentials into the URL", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/member/login");
    await credentials(page);
    const [request] = await Promise.all([
      page.waitForRequest(request => request.isNavigationRequest() && request.method() === "POST"),
      page.getByRole("button", { name: "교인 로그인", exact: true }).click(),
    ]);
    assertNoCredentialsInUrl(request.url());
    assertNoCredentialsInUrl(page.url());
  } finally { await context.close(); }
});

function assertNoCredentialsInUrl(url) {
  const parsed = new URL(url);
  expect(parsed.pathname).toBe("/member/login");
  expect(parsed.search).toBe("");
}
