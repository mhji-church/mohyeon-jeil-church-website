import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

const TEST_MEMBER_SECRET = "local-archive-integration-member-secret";
const TEST_ADMIN_USERNAME = "local-archive-admin";
const TEST_ADMIN_PASSWORD = "local-archive-admin-password";
const TEST_YOUTUBE_IDS = {
  worship: "TESTWORSHIP",
  attendance: "TESTATTEND1",
  admin: "TESTADMIN01",
};

let baseUrl;
let databasePath;
let server;
let serverOutput = "";
let adminCookie;
const memberIds = {};

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

function memberCookie(memberId) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = `${memberId}.${expiresAt}`;
  const signature = createHmac("sha256", TEST_MEMBER_SECRET).update(payload).digest("base64url");
  return `mhji_member_session=${payload}.${signature}`;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(`Vite exited before startup.\n${serverOutput.slice(-2000)}`);
    try {
      const response = await fetch(`${baseUrl}/api/archive/videos`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for Vite.\n${serverOutput.slice(-2000)}`);
}

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "mhji-archive-api-"));
  databasePath = path.join(tempDirectory, "preview.sqlite");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const vitePath = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  server = spawn(process.execPath, [vitePath, "--host", "127.0.0.1", "--port", String(port)], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "development",
      TURSO_DATABASE_URL: databaseUrl,
      TURSO_AUTH_TOKEN: "local-test-token",
      MEMBER_SESSION_SECRET: TEST_MEMBER_SECRET,
      ADMIN_USERNAME: TEST_ADMIN_USERNAME,
      ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET: "local-archive-integration-admin-secret",
      YOUTUBE_API_KEY: "local-test-key-not-used",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
  await waitForServer();

  const login = await request("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200);
  adminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  const memberRows = [
    ["none-user", "승인없음", "approved"],
    ["worship-user", "예배회원", "approved"],
    ["full-user", "전체회원", "approved"],
    ["force-user", "변경회원", "approved"],
    ["pending-user", "대기회원", "pending"],
    ["suspended-user", "정지회원", "suspended"],
  ];
  for (const [username, name] of memberRows) {
    const signup = await request("/api/members/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "local-test-password", name, phone: "010-0000-0000", birthDate: "", position: "" }),
    });
    assert.equal(signup.status, 201);
  }
  const membersResponse = await request("/api/admin/members", { headers: { cookie: adminCookie } });
  assert.equal(membersResponse.status, 200);
  const members = (await membersResponse.json()).members;
  for (const member of members) memberIds[member.username] = member.id;

  for (const [username, , status] of memberRows) {
    if (status === "pending") continue;
    const update = await request("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ id: memberIds[username], member: { status } }),
    });
    assert.equal(update.status, 200);
  }
  const reset = await request("/api/admin/members", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ id: memberIds["force-user"], action: "reset-password" }),
  });
  assert.equal(reset.status, 200);

  for (const video of [
    { id: "worship-video", type: "worship", date: "2026-08-10", serviceType: "주일 2부 예배", title: "테스트 예배", preacher: "테스트 목사", youtubeUrl: `https://youtu.be/${TEST_YOUTUBE_IDS.worship}`, note: "예배 메모" },
    { id: "attendance-video", type: "attendance", date: "2026-08-11", serviceType: "출석 기록", title: "테스트 출석", preacher: "", youtubeUrl: `https://youtu.be/${TEST_YOUTUBE_IDS.attendance}`, note: "출석 메모" },
  ]) {
    const create = await request("/api/admin/archive/videos", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify(video),
    });
    assert.equal(create.status, 201);
  }
  for (const [username, accessLevel] of [["worship-user", "worship"], ["full-user", "full"], ["force-user", "full"]]) {
    const access = await request("/api/admin/archive/access", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ memberId: memberIds[username], accessLevel }),
    });
    assert.equal(access.status, 200);
  }
});

after(async () => {
  if (server && server.exitCode == null) {
    server.kill();
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  if (databasePath) {
    try {
      fs.rmSync(path.dirname(databasePath), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      // libsql on Windows can retain a native file handle until the Node process exits.
      if (error?.code !== "EPERM") throw error;
    }
  }
});

test("public archive responses and HTML do not reveal YouTube playback data", async () => {
  const listResponse = await request("/api/archive/videos");
  assert.equal(listResponse.status, 200);
  const listText = await listResponse.text();
  for (const id of Object.values(TEST_YOUTUBE_IDS)) assert.doesNotMatch(listText, new RegExp(id));
  assert.doesNotMatch(listText, /youtu(?:\.be|be\.com)|youtube-nocookie|embedUrl|youtubeUrl|youtubeId/i);

  const pageResponse = await request("/archive");
  assert.equal(pageResponse.status, 200);
  const html = await pageResponse.text();
  for (const id of Object.values(TEST_YOUTUBE_IDS)) assert.doesNotMatch(html, new RegExp(id));
  assert.doesNotMatch(html, /youtube-nocookie|embedUrl|youtubeUrl|youtubeId/i);
});

test("playback enforces member approval, password state, and archive level", async () => {
  assert.equal((await request("/api/archive/videos/worship-video/playback")).status, 401);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["none-user"]) } })).status, 403);

  const worshipPlayback = await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(worshipPlayback.status, 200);
  assert.match((await worshipPlayback.json()).embedUrl, new RegExp(TEST_YOUTUBE_IDS.worship));
  assert.equal((await request("/api/archive/videos/attendance-video/playback", { headers: { cookie: memberCookie(memberIds["worship-user"]) } })).status, 403);
  assert.equal((await request("/api/archive/videos/attendance-video/playback", { headers: { cookie: memberCookie(memberIds["full-user"]) } })).status, 200);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["force-user"]) } })).status, 403);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["pending-user"]) } })).status, 401);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["suspended-user"]) } })).status, 401);
});

test("attendance thumbnails are face-safe before authorization", async () => {
  const response = await request("/api/archive/videos/attendance-video/thumbnail");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/);
  const body = await response.text();
  assert.match(body, /승인된 회원/);
  assert.doesNotMatch(body, new RegExp(TEST_YOUTUBE_IDS.attendance));
});

test("archive administration requires auth and local CRUD rejects unsafe input", async () => {
  assert.equal((await request("/api/admin/archive/videos")).status, 403);
  assert.equal((await request("/api/admin/archive/videos", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await request("/api/admin/archive/videos/worship-video", { method: "DELETE" })).status, 403);
  assert.equal((await request("/api/admin/archive/access")).status, 403);
  assert.equal((await request("/api/admin/archive/access", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await request("/api/admin/archive/youtube?url=test")).status, 403);

  assert.match(adminCookie, /^mhji_admin_session=/);

  const maliciousHost = await request("/api/admin/archive/videos", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ type: "worship", date: "2026-08-12", serviceType: "특별예배", title: "차단 테스트", youtubeUrl: `https://evilyoutube.com/watch?v=${TEST_YOUTUBE_IDS.admin}` }),
  });
  assert.equal(maliciousHost.status, 400);

  const create = await request("/api/admin/archive/videos", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({
      id: "admin-test-video",
      type: "worship",
      date: "2026-08-12",
      serviceType: "특별예배",
      title: "관리자 테스트 영상",
      youtubeUrl: `https://www.youtube.com/watch?v=${TEST_YOUTUBE_IDS.admin}`,
      thumbnailUrl: "https://127.0.0.1/private-thumbnail.jpg",
      durationSeconds: 120,
    }),
  });
  assert.equal(create.status, 201);
  const adminList = await request("/api/admin/archive/videos", { headers: { cookie: adminCookie } });
  assert.equal(adminList.status, 200);
  const stored = (await adminList.json()).videos.find((video) => video.id === "admin-test-video");
  assert.equal(stored.youtubeUrl, `https://youtu.be/${TEST_YOUTUBE_IDS.admin}`);
  assert.equal(stored.thumbnailUrl, `https://i.ytimg.com/vi/${TEST_YOUTUBE_IDS.admin}/hqdefault.jpg`);

  const missingMember = await request("/api/admin/archive/access", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ memberId: "missing-member", accessLevel: "full" }),
  });
  assert.equal(missingMember.status, 404);

  const updateAccess = await request("/api/admin/archive/access", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ memberId: memberIds["none-user"], accessLevel: "worship" }),
  });
  assert.equal(updateAccess.status, 200);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["none-user"]) } })).status, 200);

  assert.equal((await request("/api/admin/archive/videos/admin-test-video", { method: "DELETE", headers: { cookie: adminCookie } })).status, 200);
  const afterDelete = await request("/api/admin/archive/videos", { headers: { cookie: adminCookie } });
  assert.equal((await afterDelete.json()).videos.some((video) => video.id === "admin-test-video"), false);
});
