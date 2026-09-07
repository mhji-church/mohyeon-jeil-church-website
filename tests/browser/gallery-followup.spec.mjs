import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

test("mobile gallery header stays reachable and selecting photos does not move the reader", async ({ page, browserName }, testInfo) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    const text = message.text();
    const localReport = /the policy is report-only/i.test(text) && /unsafe-eval|https:\/\/mhji\.kr\/assets\//i.test(text);
    const localManifest = browserName === "webkit" && /does not specify a 'report-to'|Refused to load https:\/\/mhji\.kr\/manifest\.webmanifest|Origin http:\/\/127\.0\.0\.1:4178 is not allowed by Access-Control-Allow-Origin/i.test(text);
    if (message.type() === "error" && !localReport && !localManifest) errors.push(text);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery");
  await page.waitForLoadState("networkidle");
  await page.goto("/member/login?return_to=%2Fgallery");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("이름 또는 기존 아이디").fill("test-member");
  await page.getByLabel("비밀번호").fill("browser-test-password");
  await page.getByRole("button", { name: "교인 로그인" }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await page.waitForLoadState("networkidle");
  const card = page.getByRole("button", { name: "브라우저 갤러리 앨범 열기" });
  await card.click();
  const dialog = page.getByRole("dialog", { name: "브라우저 갤러리 사진 보기" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(650);
  const before = process.env.GALLERY_CAPTURE_BASELINE === "1";
  const prefix = before ? "before" : "after";
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-open.png`) });
  const reader = before ? dialog : dialog.locator(".gallery-viewer-content");
  const opening = await reader.evaluate(el => ({ scroll: el.scrollTop, bodyFont: getComputedStyle(el.querySelector(".gallery-detail-copy > p")).fontSize }));
  await reader.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.screenshot({ path: testInfo.outputPath(`${prefix}-bottom.png`) });
  const close = dialog.getByRole("button", { name: "갤러리 닫기" });
  const bounds = await close.boundingBox();
  console.log(JSON.stringify({ phase: prefix, opening, closeAtBottom: bounds }));
  if (before) return;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.y + bounds.height).toBeLessThan(844);
  expect(opening.scroll).toBe(0);
  expect(opening.bodyFont).toBe("16px");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await reader.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const readingPosition = await reader.evaluate(el => el.scrollTop);
    await dialog.getByRole("button", { name: "2번 사진 보기" }).click();
    await expect(dialog.getByText("2 / 2", { exact: true })).toBeVisible();
    expect(Math.abs(await reader.evaluate(el => el.scrollTop) - readingPosition)).toBeLessThan(2);
    const saving = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "사진 저장", exact: true }).click();
    expect((await saving).suggestedFilename()).toContain("사진-02.jpg");
    const saveBox = await dialog.getByRole("button", { name: "사진 저장", exact: true }).boundingBox();
    expect(saveBox.height).toBeGreaterThanOrEqual(44);
    expect(saveBox.height).toBeLessThanOrEqual(48);
    expect(saveBox.y).toBeGreaterThan((await dialog.locator("header").boundingBox()).height);
    expect(saveBox.y + saveBox.height).toBeLessThan(844);
    expect((await close.boundingBox()).y).toBeGreaterThanOrEqual(0);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`after-${width}-save.png`) });
    await reader.evaluate(el => { el.scrollTop = 0; });
    await dialog.getByRole("button", { name: "확대", exact: true }).click();
    await expect(dialog.locator("output")).toHaveText("125%");
    await expect(dialog.locator(".zoomable-image-viewport")).toHaveCSS("touch-action", "none");
    await dialog.getByRole("button", { name: "화면 맞춤" }).click();
    await expect(dialog.locator(".zoomable-image-viewport")).toHaveCSS("touch-action", "pan-y");
    await page.screenshot({ path: testInfo.outputPath(`after-${width}-open.png`) });
  }
  await close.click();
  await expect(card).toBeFocused();
  await card.click();
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(card).toBeFocused();
  await page.goForward();
  await page.waitForLoadState("networkidle");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".gallery-viewer-content")).toHaveJSProperty("scrollTop", 0);
  if (browserName === "chromium") {
    const touch = await page.context().newCDPSession(page);
    const photo = dialog.locator(".zoomable-image-viewport");
    const rect = await photo.boundingBox();
    const point = (x, y, id = 1) => ({ x, y, id });
    const send = (type, touchPoints) => touch.send("Input.dispatchTouchEvent", { type, touchPoints });
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    await send("touchStart", [point(cx, rect.y + rect.height - 10)]);
    for (let step = 1; step <= 6; step++) await send("touchMove", [point(cx, rect.y + rect.height - 10 - step * 20)]);
    await send("touchEnd", []);
    await expect.poll(() => reader.evaluate(el => el.scrollTop)).toBeGreaterThan(30);
    let lastScroll = -1;
    await expect.poll(async () => {
      const current = await reader.evaluate(el => el.scrollTop);
      const stable = current === lastScroll;
      lastScroll = current;
      return stable;
    }).toBe(true);
    await reader.evaluate(el => { el.scrollTo({ top: 0, behavior: "instant" }); });
    await expect.poll(() => reader.evaluate(el => el.scrollTop)).toBe(0);
    await send("touchStart", [point(cx + 90, cy)]);
    for (let step = 1; step <= 6; step++) await send("touchMove", [point(cx + 90 - step * 30, cy)]);
    await send("touchEnd", []);
    await expect(dialog.getByText("2 / 2", { exact: true })).toBeVisible();
    await send("touchStart", [point(cx - 25, cy, 1), point(cx + 25, cy, 2)]);
    for (let step = 1; step <= 5; step++) await send("touchMove", [point(cx - 25 - step * 8, cy, 1), point(cx + 25 + step * 8, cy, 2)]);
    await send("touchEnd", []);
    await expect.poll(async () => parseInt(await dialog.locator("output").textContent())).toBeGreaterThan(100);
    const scrollBeforePan = await reader.evaluate(el => el.scrollTop);
    await send("touchStart", [point(cx, cy)]);
    await send("touchMove", [point(cx + 30, cy + 20)]);
    await send("touchEnd", []);
    expect(await reader.evaluate(el => el.scrollTop)).toBe(scrollBeforePan);
    await dialog.getByRole("button", { name: "화면 맞춤" }).click();
    await touch.detach();
  } else {
    // WebKit has no CDP touch injection; exercise its TouchEvent pinch handler.
    await dialog.locator(".zoomable-image-viewport").evaluate(el => {
      const dispatch = (type, touches) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: [] } });
        el.dispatchEvent(event);
      };
      dispatch("touchstart", [{ clientX: 120, clientY: 180 }, { clientX: 180, clientY: 180 }]);
      dispatch("touchmove", [{ clientX: 90, clientY: 180 }, { clientX: 210, clientY: 180 }]);
      dispatch("touchend", []);
    });
    await expect(dialog.locator("output")).toHaveText("200%");
    await dialog.getByRole("button", { name: "화면 맞춤" }).click();
  }
  await close.click();
  for (const title of ["정사각형 한 장 앨범", "세로형 사진과 함께 확인하는 아주 긴 앨범 제목입니다 글자가 확대되어도 닫기 버튼은 항상 눌릴 수 있어야 합니다"]) {
    const singleCard = page.getByRole("button", { name: `${title} 앨범 열기` });
    await expect(singleCard.locator(".gallery-count-mobile")).toHaveText("사진 1장");
    await expect(singleCard.locator(".gallery-cover-backdrop")).toHaveCount(0);
    await expect(singleCard.locator(".gallery-album-cover > img")).toHaveCSS("object-fit", "cover");
    await singleCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`after-${title.startsWith("세로") ? "portrait" : "square"}-card.png`) });
    await singleCard.click();
    const singleDialog = page.getByRole("dialog");
    await expect(singleDialog.getByText("1 / 1", { exact: true })).toBeVisible();
    await expect(singleDialog.getByRole("button", { name: "다음 사진", exact: true })).toHaveCount(0);
    await expect(singleDialog.locator(".gallery-thumbnail-picker")).toHaveCount(0);
    await expect(singleDialog.locator(".gallery-zoomable img")).toHaveCSS("object-fit", "contain");
    await expect.poll(() => singleDialog.locator(".gallery-zoomable img").evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
    const imageViewport = await singleDialog.locator(".zoomable-image-viewport").boundingBox();
    expect(imageViewport.width).toBeGreaterThanOrEqual(320 - 1);
    if (title.startsWith("세로")) expect(imageViewport.height).toBeGreaterThan(imageViewport.width);
    else expect(Math.abs(imageViewport.height - imageViewport.width)).toBeLessThan(2);
    console.log(JSON.stringify({
      phase: "intrinsic-photo",
      kind: title.startsWith("세로") ? "portrait" : "square",
      viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
      image: imageViewport,
      bodyFont: await singleDialog.locator(".gallery-detail-copy > p").evaluate(el => getComputedStyle(el).fontSize),
      saveHeight: (await singleDialog.getByRole("button", { name: "사진 저장", exact: true }).boundingBox()).height,
    }));
    await page.screenshot({ path: testInfo.outputPath(`after-${title.startsWith("세로") ? "portrait" : "square"}-photo.png`) });
    for (const size of [{ width: 320, height: 720 }, { width: 740, height: 390 }]) {
      await page.setViewportSize(size);
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await singleDialog.locator(".gallery-viewer-content").evaluate(el => { el.scrollTop = el.scrollHeight; });
      const closeBox = await singleDialog.getByRole("button", { name: "갤러리 닫기" }).boundingBox();
      expect(closeBox.y).toBeGreaterThanOrEqual(0);
      expect(closeBox.y + closeBox.height).toBeLessThan(size.height);
      const largeSave = await singleDialog.getByRole("button", { name: "사진 저장", exact: true }).boundingBox();
      expect(largeSave.y).toBeGreaterThanOrEqual((await singleDialog.locator("header").boundingBox()).height);
      expect(largeSave.y + largeSave.height).toBeLessThan(size.height);
      expect(await singleDialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`after-${title.startsWith("세로") ? "portrait" : "square"}-${size.width}-large-text.png`) });
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    }
    await singleDialog.getByRole("button", { name: "갤러리 닫기" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
  }
  for (const width of [820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(card.locator(".gallery-count-desktop")).toHaveText("2 PHOTOS");
    await card.click();
    await expect(dialog.locator(".gallery-download-actions")).not.toBeVisible();
    await expect(dialog.locator(".gallery-viewer-content")).toHaveCSS("display", "contents");
    await page.screenshot({ path: testInfo.outputPath(`after-${width}-desktop.png`) });
    await close.click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery?album=browser-gallery");
  await page.waitForLoadState("networkidle");
  await expect(dialog).toBeVisible();
  await close.click();
  await expect(page).toHaveURL(/\/gallery$/);
  expect(errors).toEqual([]);
});
