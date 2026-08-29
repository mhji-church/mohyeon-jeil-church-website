import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import ExcelJS from "exceljs";
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
let serverStdout = "";
let serverStderr = "";
let serverCommand = "";
let adminCookie;
let websiteAdminCookie;
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
  const readinessPaths = ["/api/archive/videos", "/archive"];
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(serverFailure("Vite exited before startup."));
    try {
      const responses = await Promise.all(readinessPaths.map((pathname) =>
        fetch(`${baseUrl}${pathname}`, { signal: AbortSignal.timeout(5_000) })
      ));
      if (responses.every((response) => response.ok)) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(serverFailure("Timed out waiting for Vite."));
}

function serverFailure(message) {
  return [
    message,
    `Command: ${serverCommand}`,
    `Readiness URLs: ${baseUrl}/api/archive/videos, ${baseUrl}/archive`,
    `Exit code: ${server?.exitCode ?? "running"}`,
    `stdout:\n${serverStdout.slice(-4000) || "(empty)"}`,
    `stderr:\n${serverStderr.slice(-4000) || "(empty)"}`,
  ].join("\n");
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
  const serverArgs = [vitePath, "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--configLoader", "runner"];
  serverCommand = [process.execPath, ...serverArgs].map((part) => JSON.stringify(part)).join(" ");
  server = spawn(process.execPath, serverArgs, {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      ...process.env,
      NODE_ENV: "development",
      TURSO_DATABASE_URL: databaseUrl,
      TURSO_AUTH_TOKEN: "local-test-token",
      MEMBER_SESSION_SECRET: TEST_MEMBER_SECRET,
      ADMIN_USERNAME: TEST_ADMIN_USERNAME,
      ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET: "local-archive-integration-admin-secret",
      ARCHIVE_ADMIN_USERNAME: TEST_ADMIN_USERNAME,
      ARCHIVE_ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      ARCHIVE_ADMIN_SESSION_SECRET: "local-archive-integration-separate-secret",
      YOUTUBE_API_KEY: "local-test-key-not-used",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { serverStdout += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverStderr += chunk.toString(); });
  await waitForServer();

  const login = await request("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200);
  adminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  websiteAdminCookie = adminCookie;

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
  const pendingSummaryResponse = await request("/api/admin/members?summary=pending", {
    headers: { cookie: adminCookie },
  });
  assert.equal(pendingSummaryResponse.status, 200);
  assert.deepEqual(await pendingSummaryResponse.json(), { pendingCount: 1 });
  const reset = await request("/api/admin/members", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ id: memberIds["force-user"], action: "reset-password" }),
  });
  assert.equal(reset.status, 200);

  const archiveLogin = await request("/api/archive/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(archiveLogin.status, 200);
  adminCookie = (archiveLogin.headers.get("set-cookie") ?? "").split(";")[0];

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
    const stopped = await Promise.race([
      new Promise((resolve) => server.once("exit", () => resolve(true))),
      new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);
    if (!stopped && server.exitCode == null) {
      server.kill("SIGKILL");
      await Promise.race([
        new Promise((resolve) => server.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
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

  for (const route of ["/archive/sunday", "/archive/other", "/archive/attendance"]) {
    const sectionResponse = await request(route);
    assert.equal(sectionResponse.status, 200);
    const sectionHtml = await sectionResponse.text();
    for (const id of Object.values(TEST_YOUTUBE_IDS)) assert.doesNotMatch(sectionHtml, new RegExp(id));
    assert.doesNotMatch(sectionHtml, /youtube-nocookie|embedUrl|youtubeUrl|youtubeId/i);
  }
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
  assert.equal((await request("/api/admin/archive/videos", { headers: { cookie: websiteAdminCookie } })).status, 403);
  assert.equal((await request("/api/admin/archive/videos", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await request("/api/admin/archive/videos/worship-video", { method: "DELETE" })).status, 403);
  assert.equal((await request("/api/admin/archive/access")).status, 403);
  assert.equal((await request("/api/admin/archive/access", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await request("/api/admin/archive/youtube?url=test")).status, 403);

  assert.match(adminCookie, /^mhji_archive_admin_session=/);

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
  const duplicate = await request("/api/admin/archive/videos", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({
      id: "admin-test-video-duplicate",
      type: "worship",
      date: "2026-08-13",
      serviceType: "특별예배",
      title: "중복 등록 차단",
      youtubeUrl: `https://youtu.be/${TEST_YOUTUBE_IDS.admin}`,
    }),
  });
  assert.equal(duplicate.status, 400);
  assert.match((await duplicate.json()).error, /이미 등록된/);
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

test("archive stores directly entered worship contents and expands search", async () => {
  const create = await request("/api/admin/archive/videos", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({
      id: "analysis-fixture-video",
      type: "worship",
      date: "2026-05-31",
      serviceType: "주일 1부 예배",
      title: "2026년 5월 31일 주일 1부 예배",
      preacher: "담임목사",
      youtubeUrl: "https://youtu.be/QzMhKdz1Duo",
      durationSeconds: 4200,
      songsText: ["내 모든 시험 무거운 짐을", "넘지 못할 산이 있거든", "먼저 그 나라와 그의 의를 구하라"].join("\n"),
      sermonTitle: "하나님의 나라를 먼저 구하라",
      biblePassage: "마태복음 6:33",
      prayerName: "김믿음",
      prayerRole: "집사",
    }),
  });
  assert.equal(create.status, 201);

  const adminList = await request("/api/admin/archive/videos?search=하나님의%20나라", { headers: { cookie: adminCookie } });
  assert.equal(adminList.status, 200);
  const stored = (await adminList.json()).videos.find((video) => video.id === "analysis-fixture-video");
  assert.equal(stored.analysis.status, "completed");
  assert.deepEqual(stored.analysis.songs.map((song) => song.title), [
    "내 모든 시험 무거운 짐을",
    "넘지 못할 산이 있거든",
    "먼저 그 나라와 그의 의를 구하라",
  ]);
  assert.equal(stored.analysis.songs.some((song) => /나 주님의 기쁨/.test(song.title)), false);
  assert.equal(stored.analysis.sermon.biblePassage, "마태복음 6:33");
  assert.equal(stored.analysis.representativePrayer.name, "김믿음");

  const publicSearch = await request("/api/archive/videos?q=넘지%20못할");
  assert.equal(publicSearch.status, 200);
  const publicVideo = (await publicSearch.json()).videos.find((video) => video.id === "analysis-fixture-video");
  assert.equal(publicVideo.analysis.songs.length, 3);
});

test("song statistics, history, administration, and Excel export share archive access rules", async () => {
  assert.equal((await request("/api/archive/songs/stats")).status, 403);
  assert.equal((await request("/api/archive/songs/stats", { headers: { cookie: memberCookie(memberIds["pending-user"]) } })).status, 403);

  const statsResponse = await request("/api/archive/songs/stats?service=sunday1&period=all&limit=20", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(statsResponse.status, 200);
  assert.match(statsResponse.headers.get("cache-control") ?? "", /no-store/);
  const stats = await statsResponse.json();
  assert.equal(stats.summary.worshipCount, 1);
  assert.equal(stats.summary.songCount, 3);
  assert.equal(stats.summary.usageCount, 3);
  const song = stats.rankings.find((item) => item.displayTitle === "넘지 못할 산이 있거든");
  assert.ok(song);
  assert.equal(song.sunday1Count, 1);

  const history = await request(`/api/archive/songs/${encodeURIComponent(song.id)}/history?service=sunday1&period=all`, { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(history.status, 200);
  const historyBody = await history.json();
  assert.equal(historyBody.history[0].videoId, "analysis-fixture-video");

  assert.equal((await request("/api/admin/archive/songs", { headers: { cookie: websiteAdminCookie } })).status, 403);
  const catalogResponse = await request("/api/admin/archive/songs?q=넘지", { headers: { cookie: adminCookie } });
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.songs.length, 1);
  assert.equal(catalog.songs[0].usageCount, 1);
  assert.ok(Array.isArray(catalog.conflicts));

  const excel = await request("/api/archive/songs/export?service=sunday1&period=all&limit=20", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(excel.status, 200);
  assert.match(excel.headers.get("content-type") ?? "", /spreadsheetml/);
  assert.match(excel.headers.get("content-disposition") ?? "", /%EC%B0%AC%EC%96%91%ED%86%B5%EA%B3%84/);
  const bytes = new Uint8Array(await excel.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 2)), [0x50, 0x4b]);
  assert.ok(bytes.length > 5000);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["찬양 순위", "사용 이력"]);
  const rankingSheet = workbook.getWorksheet("찬양 순위");
  const historySheet = workbook.getWorksheet("사용 이력");
  assert.ok(rankingSheet.getColumn("B").values.includes("넘지 못할 산이 있거든"));
  assert.equal(typeof rankingSheet.getCell("E2").value, "number");
  assert.ok(rankingSheet.getCell("I2").value instanceof Date);
  assert.equal(historySheet.getCell("F2").value.toString().startsWith("https://mhji.kr/archive/"), true);
});

test("representative titles, aliases, service filters, conflicts, ordering, and deletion remain consistent", async () => {
  const videos = [
    { id: "alias-sunday2", youtubeUrl: "https://youtu.be/ALIASVID001", date: "2026-06-07", serviceType: "주일 2부 예배", songsText: "부흥(이 땅의 황무함을 보소서)\n부흥\n이 땅의 황무함을 보소서" },
    { id: "alias-sunday1", youtubeUrl: "https://youtu.be/ALIASVID002", date: "2026-06-07", serviceType: "주일 1부 예배", songsText: "부흥" },
    { id: "alias-wednesday", youtubeUrl: "https://youtu.be/ALIASVID003", date: "2026-06-10", serviceType: "수요예배", songsText: "이 땅의 황무함을 보소서" },
  ];
  for (const video of videos) {
    const response = await request("/api/admin/archive/videos", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ ...video, type: "worship", title: `${video.id} 예배`, preacher: "담임목사" }),
    });
    assert.equal(response.status, 201);
  }

  for (const query of ["부흥", "이 땅의 황무함을 보소서", "부흥(이 땅의 황무함을 보소서)"]) {
    const response = await request(`/api/admin/archive/songs?q=${encodeURIComponent(query)}`, { headers: { cookie: adminCookie } });
    assert.equal(response.status, 200);
    const matches = (await response.json()).songs.filter((item) => item.displayTitle === "부흥(이 땅의 황무함을 보소서)");
    assert.equal(matches.length, 1);
    assert.equal(matches[0].usageCount, 3);
  }

  const allStats = await request("/api/archive/songs/stats?service=all&period=year&year=2026&limit=100&q=%EB%B6%80%ED%9D%A5", { headers: { cookie: memberCookie(memberIds["full-user"]) } });
  assert.equal(allStats.status, 200);
  const consolidated = (await allStats.json()).rankings[0];
  assert.equal(consolidated.totalCount, 3);
  assert.equal(consolidated.sunday1Count, 1);
  assert.equal(consolidated.sunday2Count, 1);
  assert.equal(consolidated.wednesdayCount, 1);
  assert.equal(consolidated.lastUsed, "2026-06-10");

  for (const [service, expected] of [["sunday1", 1], ["sunday2", 1], ["wednesday", 1]]) {
    const response = await request(`/api/archive/songs/stats?service=${service}&period=custom&start=2026-06-07&end=2026-06-10&limit=10&q=%EB%B6%80%ED%9D%A5`, { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).rankings[0].totalCount, expected);
  }
  assert.equal((await request("/api/archive/songs/stats?service=invalid", { headers: { cookie: memberCookie(memberIds["worship-user"]) } })).status, 400);
  assert.equal((await request("/api/archive/songs/stats?period=custom&start=2026-99-99", { headers: { cookie: memberCookie(memberIds["worship-user"]) } })).status, 400);
  assert.equal((await request("/api/archive/songs/stats?limit=37", { headers: { cookie: memberCookie(memberIds["worship-user"]) } })).status, 400);

  const reorder = await request("/api/admin/archive/videos", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ ...videos[0], type: "worship", title: "순서 수정 예배", preacher: "담임목사", songsText: "내 평생에 가는 길\n부흥" }),
  });
  assert.equal(reorder.status, 201);
  const catalog = await request("/api/admin/archive/songs?q=%EB%B6%80%ED%9D%A5", { headers: { cookie: adminCookie } });
  const songId = (await catalog.json()).songs[0].id;
  const history = await request(`/api/archive/songs/${songId}/history?service=sunday2&period=all&limit=50`, { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal((await history.json()).history.find((item) => item.videoId === "alias-sunday2").order, 2);

  const collision = await request("/api/admin/archive/videos", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ id: "alias-collision", type: "worship", youtubeUrl: "https://youtu.be/ALIASVID004", date: "2026-06-14", serviceType: "주일 2부 예배", title: "충돌 예배", songsText: "새 곡(이 땅의 황무함을 보소서)" }),
  });
  assert.equal(collision.status, 201);
  const collisionCatalog = await request("/api/admin/archive/songs?q=%EC%83%88%20%EA%B3%A1", { headers: { cookie: adminCookie } });
  const collisionBody = await collisionCatalog.json();
  assert.equal(collisionBody.songs[0].displayTitle, "새 곡(이 땅의 황무함을 보소서)");
  assert.ok(collisionBody.conflicts.some((item) => item.inputTitle === "새 곡(이 땅의 황무함을 보소서)"));

  assert.equal((await request("/api/admin/archive/videos/alias-collision", { method: "DELETE", headers: { cookie: adminCookie } })).status, 200);
  const afterDelete = await request("/api/admin/archive/songs?q=%EC%83%88%20%EA%B3%A1", { headers: { cookie: adminCookie } });
  assert.equal((await afterDelete.json()).songs[0].usageCount, 0);
});

test("deleting a member also removes archive access rows", async () => {
  const memberId = memberIds["none-user"];
  const response = await request(`/api/admin/members?id=${encodeURIComponent(memberId)}`, {
    method: "DELETE",
    headers: { cookie: websiteAdminCookie },
  });
  assert.equal(response.status, 200);

  const client = createClient({
    url: `file:${databasePath.replaceAll("\\", "/")}`,
    authToken: "local-test-token",
  });
  try {
    const access = await client.execute({
      sql: "SELECT COUNT(*) AS count FROM member_app_access WHERE member_id = ?",
      args: [memberId],
    });
    assert.equal(Number(access.rows[0]?.count ?? -1), 0);
  } finally {
    client.close();
  }
});
