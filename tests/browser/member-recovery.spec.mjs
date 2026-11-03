import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test("direct member recovery changes the password without an administrator at " + width + "px", async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const name = "가상직접복구" + width;
    const username = "direct-browser-" + width;
    const oldPassword = "direct-original-password";
    const password = "direct-new-password";
    expect((await request.post("/api/members/signup", { data: { username, name, password: oldPassword, birthDate: "2000-01-02", phone: "010-7733-8844", position: "집사" } })).status()).toBe(201);
    const oldLogin = await request.post("/api/members/session", { data: { username, password: oldPassword } });
    expect(oldLogin.status()).toBe(200);
    const oldCookie = oldLogin.headers()["set-cookie"].split(";")[0];
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let calls = 0;
    page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/members/recovery")) calls += 1; });
    await page.goto("/member/login", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "비밀번호를 잊으셨나요?" }).click();
    await expect(page).toHaveURL(/\/member\/recovery$/);
    await expect(page.getByText("가입하신 이름과 생년월일 6자리를 입력해 주세요.")).toBeVisible();
    const birth = page.getByLabel("생년월일 6자리", { exact: true });
    await expect(birth).toHaveAttribute("type", "text");
    await expect(birth).toHaveAttribute("inputmode", "numeric");
    await expect(birth).toHaveAttribute("placeholder", "예: 041225");
    await expect(page.locator("#recovery-birth-help")).toContainText("2004년 12월 25일 → 041225");
    await page.getByLabel("이름", { exact: true }).fill(name);
    await birth.fill("000102");
    await expect(birth).toHaveValue("000102");
    await page.screenshot({ path: "test-results/direct-recovery-identity-" + width + ".png", fullPage: true });
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/api/members/recovery")),
      page.getByRole("button", { name: "다음", exact: true }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private, no-store");
    await expect(page.getByLabel("새 비밀번호", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.cookie.includes("mhji_member_recovery"))).toBe(false);
    await expect(page.getByText("관리자에게 재설정 요청")).toHaveCount(0);
    await page.getByLabel("새 비밀번호", { exact: true }).fill(password);
    await page.getByLabel("새 비밀번호 확인", { exact: true }).fill("mismatch");
    await page.getByRole("button", { name: "새 비밀번호 저장" }).click();
    await expect(page.getByRole("alert")).toHaveText("비밀번호 확인이 일치하지 않습니다.");
    expect(calls).toBe(1);
    await page.getByLabel("새 비밀번호 확인", { exact: true }).fill(password);
    await page.getByLabel("비밀번호 표시", { exact: true }).check();
    await expect(page.getByLabel("새 비밀번호", { exact: true })).toHaveAttribute("type", "text");
    await page.getByLabel("비밀번호 표시", { exact: true }).uncheck();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: "test-results/direct-recovery-password-" + width + ".png", fullPage: true });
    await page.getByRole("button", { name: "새 비밀번호 저장" }).click();
    await expect(page.getByRole("status").locator("p")).toHaveText("비밀번호가 변경되었습니다. 이름 또는 기존 아이디와 새 비밀번호로 로그인해 주세요.");
    expect(calls).toBe(2);
    await page.screenshot({ path: "test-results/direct-recovery-complete-" + width + ".png", fullPage: true });
    expect((await (await request.get("/api/session", { headers: { cookie: oldCookie } })).json()).authenticated).toBe(false);
    expect((await request.post("/api/members/session", { data: { username, password: oldPassword } })).status()).toBe(401);
    await page.getByRole("link", { name: "로그인 화면으로 이동" }).click();
    await expect(page).toHaveURL(/\/member\/login$/);
    await page.getByLabel("이름 또는 기존 아이디").fill(name);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: "교인 로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  });
}

test("invalid and ambiguous hints never change an account and expired grants return to the first step", async ({ page }) => {
  await page.goto("/member/recovery", { waitUntil: "networkidle" });
  await page.getByLabel("이름", { exact: true }).fill("가상미등록회원");
  await page.getByLabel("생년월일 6자리", { exact: true }).fill("000102");
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith("/api/members/recovery")),
    page.getByRole("button", { name: "다음", exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  await page.getByLabel("새 비밀번호", { exact: true }).fill("not-a-valid-target");
  await page.getByLabel("새 비밀번호 확인", { exact: true }).fill("not-a-valid-target");
  await page.getByRole("button", { name: "새 비밀번호 저장" }).click();
  await expect(page.getByRole("alert")).toContainText("입력 정보가 일치하지 않거나 재설정 시간이 만료");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "처음부터 다시 입력" }).click();
  await expect(page.getByLabel("생년월일 6자리", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test("direct recovery request limits and service failures stay distinct", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/members/recovery", route => {
    attempt += 1;
    return route.fulfill(attempt === 1
      ? { status: 429, headers: { "Retry-After": "300" }, json: { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." } }
      : { status: 503, json: { error: "재설정 시스템에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." } });
  });
  await page.goto("/member/recovery", { waitUntil: "networkidle" });
  await page.getByLabel("이름", { exact: true }).fill("가상과다요청");
  await page.getByLabel("생년월일 6자리", { exact: true }).fill("821108");
  for (const expected of ["요청이 많습니다", "재설정 시스템에 연결하지 못했습니다"]) {
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(expected);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  }
});
