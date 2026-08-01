import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const netlifyEntry = new URL(
    "../.netlify/functions-internal/server/main.mjs",
    import.meta.url,
  );
  const workerEntry = new URL("../dist/server/index.js", import.meta.url);
  const serverUrl = existsSync(netlifyEntry) ? netlifyEntry : workerEntry;
  serverUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: server } = await import(serverUrl.href);

  const request = new Request("http://localhost/", {
    headers: { accept: "text/html" },
  });
  const response = typeof server.fetch === "function"
    ? await server.fetch(
      request,
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    )
    : await server(request);

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, />교인 로그인</);
  assert.match(html, /hero-spring-mobile\.webp/);
  assert.equal((html.match(/class="site-header/g) ?? []).length, 1);
  assert.equal((html.match(/<footer id="gallery"/g) ?? []).length, 1);

  const adminResponse = typeof server.fetch === "function"
    ? await server.fetch(
      new Request("http://localhost/admin/login", { headers: { accept: "text/html" } }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    )
    : await server(new Request("http://localhost/admin/login"));
  const adminHtml = await adminResponse.text();
  assert.doesNotMatch(adminHtml, /class="site-header/);
  assert.doesNotMatch(adminHtml, /<footer id="gallery"/);
});
