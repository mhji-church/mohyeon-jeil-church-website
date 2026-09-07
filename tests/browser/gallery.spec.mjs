import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.setTimeout(90_000);

function watchErrors(page, browserName) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    const text = message.text();
    const expectedLocalCspReport =
      /the policy is report-only/i.test(text) &&
      (/unsafe-eval/i.test(text) || /https:\/\/mhji\.kr\/assets\//i.test(text));
    const expectedLocalWebKitManifest = browserName === "webkit" && (
      /does not specify a 'report-to'|Refused to load https:\/\/mhji\.kr\/manifest\.webmanifest|Origin http:\/\/127\.0\.0\.1:4178 is not allowed by Access-Control-Allow-Origin/i.test(text)
    );
    if (!expectedLocalCspReport && !expectedLocalWebKitManifest && message.type() === "error") {
      errors.push(text);
    }
  });
  return errors;
}

test("gallery cards stay responsive and approved members can read and save the selected photo", async ({ page, browserName }) => {
  const downloadPath = "/api/gallery/download?post_id=browser-gallery&image=1";
  const errors = watchErrors(page, browserName);
  const viewports = [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 1000 },
  ];
  await page.setViewportSize(viewports[0]);
  await page.goto("/gallery");
  const denied = await page.context().request.get(downloadPath);
  expect(denied.status()).toBe(404);
  expect(denied.headers()["cache-control"]).toContain("private, no-store");

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const card = page.getByRole("link", { name: /브라우저 갤러리/ });
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (viewport.width <= 390) {
      const cover = card.locator(".gallery-album-cover");
      const title = card.getByRole("heading", { name: "브라우저 갤러리" });
      const [cardBox, coverBox, titleBox] = await Promise.all([
        card.boundingBox(),
        cover.boundingBox(),
        title.boundingBox(),
      ]);
      expect(cardBox?.width ?? 0).toBeGreaterThan(viewport.width * 0.84);
      expect(Math.abs((coverBox?.width ?? 0) - (cardBox?.width ?? 0))).toBeLessThanOrEqual(2);
      expect((coverBox?.y ?? 0) + (coverBox?.height ?? 0)).toBeLessThanOrEqual(titleBox?.y ?? 0);
      expect(await cover.locator("img").evaluate((image) => getComputedStyle(image).objectFit)).toBe("contain");
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/member/login?return_to=%2Fgallery");
  await page.getByLabel("이름 또는 기존 아이디").fill("test-member");
  await page.getByLabel("비밀번호").fill("browser-test-password");
  await page.getByRole("button", { name: "교인 로그인" }).click();
  await expect(page).toHaveURL(/\/gallery/);

  const card = page.getByRole("button", { name: "브라우저 갤러리 앨범 열기" });
  await card.click();
  const dialog = page.getByRole("dialog", { name: "브라우저 갤러리 사진 보기" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "브라우저 갤러리" })).toBeVisible();
  await expect(dialog.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/모현제일교회 갤러리 본문 14/)).toBeVisible();
  expect(await dialog.locator(".gallery-viewer-content").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await dialog.getByRole("button", { name: "다음 사진" }).click();
  await expect(dialog.getByText("2 / 2", { exact: true })).toBeVisible();
  const activePhoto = dialog.getByAltText("브라우저 갤러리 사진 2");
  await expect(activePhoto).toBeVisible();
  const mediaResponse = await page.context().request.get("/api/gallery/media?post_id=browser-gallery&image=1");
  expect(mediaResponse.status()).toBe(200);
  await expect.poll(() => activePhoto.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

  const protectedResponse = await page.context().request.get(downloadPath);
  expect(protectedResponse.status()).toBe(200);
  expect(protectedResponse.headers()["cache-control"]).toContain("private, no-store");
  expect(protectedResponse.headers()["content-disposition"]).toContain("%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80%20%EA%B0%A4%EB%9F%AC%EB%A6%AC");
  expect(protectedResponse.headers()["content-disposition"]).toContain("%EC%82%AC%EC%A7%84-02.jpg");
  const expectedImage = await readFile(new URL("../../public/assets/mhji/gallery-pink-03.jpg", import.meta.url));
  expect(Buffer.compare(Buffer.from(await protectedResponse.body()), expectedImage)).toBe(0);

  const downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "사진 저장" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("2026-08-20_브라우저 갤러리_사진-02.jpg");
  const savedImage = await readFile(await download.path());
  expect(Buffer.compare(savedImage, expectedImage)).toBe(0);
  await expect(dialog.locator(".gallery-download-notice")).toContainText("2번 사진 저장을 시작했습니다");

  const closeButton = dialog.getByRole("button", { name: "갤러리 닫기" });
  await closeButton.click();
  await expect(card).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});
