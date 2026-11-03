import { expect, test } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`member self withdrawal is confirmed, cancellable and private at ${width}px`, async ({ page, request }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    const name = `가상탈퇴${width}`;
    const password = `withdrawal-${width}-password`;
    const signup = await request.post("/api/members/signup", { data: { username: `withdrawal-${width}`, name, password, birthDate: "1982-11-08", phone: `010-6600-${String(width).padStart(4, "0")}`, position: "집사" } });
    expect(signup.status()).toBe(201);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !/Failed to load resource: the server responded with a status of (401|503)/.test(message.text())) errors.push(message.text()); });
    let attempts = 0;
    page.on("request", request => { if (request.url().endsWith("/api/members/withdrawal")) attempts += 1; });
    await page.goto("/member/login?return_to=/member", { waitUntil: "networkidle" });
    // Streamed SSR may finish network requests before the client handler is
    // attached. Require the real toggle transition before entering credentials.
    await expect.poll(async () => {
      const type = await page.getByLabel("비밀번호").getAttribute("type");
      if (type === "text") return type;
      await page.getByRole("button", { name: "보기", exact: true }).click();
      return page.getByLabel("비밀번호").getAttribute("type");
    }, { timeout: 10_000 }).toBe("text");
    await expect(page.getByLabel("비밀번호")).toHaveAttribute("type", "text");
    await page.getByLabel("이름 또는 기존 아이디").fill(name);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: "교인 로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/member$/);
    await expect(page.getByRole("heading", { name: "내 정보 관리" })).toBeVisible();
    const oldCookie = (await page.context().cookies()).find(cookie => cookie.name === "mhji_member_session");
    expect(oldCookie).toBeTruthy();
    const entry = page.locator(".member-withdrawal-entry > button");
    await entry.click();
    const dialog = page.getByRole("dialog", { name: "회원 탈퇴", exact: true });
    const submit = dialog.getByRole("button", { name: "회원 탈퇴", exact: true });
    const cancel = dialog.getByRole("button", { name: "취소", exact: true });
    await expect(cancel).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("현재 비밀번호").fill(password);
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("탈퇴 안내를 확인했습니다").check();
    await expect(submit).toBeEnabled();
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    await expect(entry).toBeFocused();
    expect(attempts).toBe(0);
    // Capture only after an interaction proves hydration. Screenshot caret
    // hiding otherwise mutates input styles while React is still hydrating.
    await page.screenshot({ path: `test-results/member-profile-withdrawal-${width}.png`, fullPage: true });
    await entry.click();
    await expect(dialog.getByLabel("현재 비밀번호")).toHaveValue("");
    await expect(dialog.getByLabel("탈퇴 안내를 확인했습니다")).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(attempts).toBe(0);
    await entry.click();
    await dialog.getByRole("button", { name: "회원 탈퇴 창 닫기" }).click();
    await expect(dialog).toHaveCount(0);
    expect(attempts).toBe(0);
    await entry.click();
    await dialog.getByLabel("현재 비밀번호").fill("incorrect-password");
    await dialog.getByLabel("탈퇴 안내를 확인했습니다").check();
    await submit.click();
    await expect(dialog.getByRole("alert")).toHaveText("현재 비밀번호를 확인해 주세요.");
    expect((await (await page.request.get("/api/session")).json()).authenticated).toBe(true);
    await page.screenshot({ path: `test-results/member-withdrawal-error-${width}.png` });
    await page.route("**/api/members/withdrawal", route => route.fulfill({ status: 503, json: { error: "탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." } }));
    await submit.click();
    await expect(dialog.getByRole("alert")).toContainText("탈퇴를 완료하지 못했습니다");
    await expect(page.getByRole("heading", { name: "회원 탈퇴가 완료되었습니다." })).toHaveCount(0);
    await expect(submit).toBeEnabled();
    await page.unroute("**/api/members/withdrawal");
    await dialog.getByLabel("현재 비밀번호").fill(password);
    const rect = await dialog.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    expect(await submit.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await cancel.evaluate(element => getComputedStyle(element).color)).toBe("rgb(48, 48, 62)");
    expect(await dialog.locator(".member-withdrawal-actions").evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(72);
    await page.screenshot({ path: `test-results/member-withdrawal-dialog-${width}.png` });
    const beforeSubmit = attempts;
    await dialog.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect(page.getByRole("heading", { name: "회원 탈퇴가 완료되었습니다." })).toBeVisible();
    await expect(page.locator(".member-withdrawal-complete")).toBeFocused();
    expect(attempts).toBe(beforeSubmit + 1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".member-profile-form")).toHaveCount(0);
    expect((await page.context().cookies()).some(cookie => cookie.name === "mhji_member_session")).toBe(false);
    const oldSession = await request.get("/api/session", { headers: { cookie: `${oldCookie.name}=${oldCookie.value}` } });
    expect((await oldSession.json()).authenticated).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/member-withdrawal-complete-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "홈페이지로 이동", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/member");
    await expect(page).toHaveURL(/\/member\/login/);
    if (width === 1440) {
      await page.goto("/admin/login", { waitUntil: "networkidle" });
      await page.getByLabel("아이디").fill("browser-archive-admin");
      await page.getByLabel("비밀번호").fill("browser-archive-password");
      await page.getByRole("button", { name: "관리자 로그인" }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto("/admin/activity", { waitUntil: "networkidle" });
      await page.getByLabel("작업 유형 필터").selectOption("member.withdrawal");
      await expect(page.locator("tbody tr").first()).toContainText("회원 본인 탈퇴");
      await expect(page.locator("tbody tr").first()).toContainText("탈퇴 회원");
      await expect(page.locator("tbody")).not.toContainText(name);
      await page.screenshot({ path: "test-results/member-withdrawal-audit-1440.png", fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
