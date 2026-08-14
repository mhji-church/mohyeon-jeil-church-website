import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("authenticates external media with the current request cookies", () => {
  const viteConfig = readSource("../vite.config.ts");
  const mediaRoute = readSource("../app/api/media/route.ts");
  const objectRoute = readSource("../app/api/media/object/[token]/route.ts");

  assert.match(viteConfig, /request\.headers\.cookie\s*\?\?\s*null/);
  assert.match(
    mediaRoute,
    /getMemberSessionFromToken\(cookieValue\(cookieHeader, "mhji_member_session"\)\)/,
  );
  assert.match(
    mediaRoute,
    /getAdminSessionFromToken\(cookieValue\(cookieHeader, "mhji_admin_session"\)\)/,
  );
  assert.doesNotMatch(mediaRoute, /await\s+get(?:Member|Admin)Session\(\)/);
  assert.match(objectRoute, /request\.headers\.get\("cookie"\)/);
});
