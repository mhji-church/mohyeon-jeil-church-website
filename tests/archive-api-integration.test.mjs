import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import ExcelJS from "exceljs";
import { spawn } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { applyNetlifyMigrations } from "../scripts/netlify-migrations.mjs";

const TEST_MEMBER_SECRET = "local-archive-integration-member-secret";
const TEST_WEBSITE_ADMIN_USERNAME = "mhji";
const TEST_WEBSITE_ADMIN_PASSWORD = "local-website-admin-password";
const TEST_ADMIN_USERNAME = "archive-test-admin";
const TEST_ADMIN_PASSWORD = "local-archive-admin-password";
const TEST_ARCHIVE_LEGACY_SECRET = "local-archive-integration-separate-secret";
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
let forceTemporaryPassword;
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

function legacyArchiveAdminCookie() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const payload = `${encodeURIComponent(TEST_ADMIN_USERNAME)}.${expiresAt}`;
  const signature = createHmac("sha256", TEST_ARCHIVE_LEGACY_SECRET)
    .update(payload)
    .digest("base64url");
  return `mhji_archive_admin_session=${payload}.${signature}`;
}

async function waitForServer() {
  const readinessPaths = ["/api/archive/access", "/member/login"];
  const deadline = Date.now() + 120_000;
  const readiness = new Map();
  while (Date.now() < deadline) {
    if (server.exitCode != null) throw new Error(serverFailure("Vite exited before startup."));
    try {
      for (const pathname of readinessPaths) {
        const response = await fetch(`${baseUrl}${pathname}`, {
          signal: AbortSignal.timeout(30_000),
        });
        readiness.set(pathname, response.status);
      }
      if (readinessPaths.every((pathname) => readiness.get(pathname) === 200)) return;
    } catch (error) {
      readiness.set("lastError", error instanceof Error ? error.message : String(error));
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(serverFailure(`Timed out waiting for Vite. Readiness: ${JSON.stringify(Object.fromEntries(readiness))}`));
}

function serverFailure(message) {
  return [
    message,
    `Command: ${serverCommand}`,
    `Readiness URLs: ${baseUrl}/api/archive/access, ${baseUrl}/member/login`,
    `Exit code: ${server?.exitCode ?? "running"}`,
    `stdout:\n${serverStdout.slice(-4000) || "(empty)"}`,
    `stderr:\n${serverStderr.slice(-4000) || "(empty)"}`,
  ].join("\n");
}

async function request(pathname, options = {}) {
  return fetch(`${baseUrl}${pathname}`, options);
}

async function signupMember(member) {
  return request("/api/members/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(member),
  });
}

async function loginMember(username, password, forwardedFor) {
  return request("/api/members/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
    },
    body: JSON.stringify({ username, password }),
  });
}

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "mhji-archive-api-"));
  databasePath = path.join(tempDirectory, "preview.sqlite");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const migrationClient = createClient({ url: databaseUrl });
  try {
    await applyNetlifyMigrations(migrationClient);
  } finally {
    await migrationClient.close();
  }
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
      ADMIN_USERNAME: TEST_WEBSITE_ADMIN_USERNAME,
      ADMIN_PASSWORD: TEST_WEBSITE_ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET: "local-archive-integration-admin-secret",
      ARCHIVE_ADMIN_USERNAME: TEST_ADMIN_USERNAME,
      ARCHIVE_ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
      ARCHIVE_ADMIN_SESSION_SECRET: TEST_ARCHIVE_LEGACY_SECRET,
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
    body: JSON.stringify({ username: TEST_WEBSITE_ADMIN_USERNAME, password: TEST_WEBSITE_ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200);
  assert.equal((await login.clone().json()).returnTo, "/admin");
  websiteAdminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  adminCookie = websiteAdminCookie;

  const memberRows = [
    ["none-user", "승인없음", "approved"],
    ["worship-user", "예배회원", "approved"],
    ["full-user", "전체회원", "approved"],
    ["force-user", "변경회원", "approved"],
    ["pending-user", "대기회원", "pending"],
    ["suspended-user", "정지회원", "suspended"],
  ];
  for (const [index, [username, name]] of memberRows.entries()) {
    const signup = await request("/api/members/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "local-test-password", name, phone: `010-8000-${String(1000 + index)}`, birthDate: "", position: "" }),
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
  forceTemporaryPassword = (await reset.json()).temporaryPassword;

  const legacyArchiveLogin = await request("/api/archive/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(legacyArchiveLogin.status, 403);
  assert.equal(legacyArchiveLogin.headers.get("set-cookie"), null);

  const unconfiguredArchiveLogin = await request("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "other-test-admin", password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(unconfiguredArchiveLogin.status, 401);

  const archiveLogin = await request("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(archiveLogin.status, 200);
  assert.equal((await archiveLogin.clone().json()).returnTo, "/admin");
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

test("accessible member signup preserves legacy accounts and safely creates name-based logins", async () => {
  const legacyLogin = await loginMember("worship-user", "local-test-password", "198.51.100.10");
  assert.equal(legacyLogin.status, 200);
  assert.match(legacyLogin.headers.get("set-cookie") ?? "", /mhji_member_session=/);

  const invalidDates = ["2025-02-29", "2026-04-31", "2999-01-01"];
  for (const [index, birthDate] of invalidDates.entries()) {
    const response = await signupMember({
      name: `날짜검증${index}`,
      phone: `010-910${index}-1000`,
      birthDate,
      position: "",
      password: "482915",
    });
    assert.equal(response.status, 400);
  }

  for (const password of ["111111", "550312", "125678"]) {
    const response = await signupMember({
      name: `비밀번호검증${password}`,
      phone: "010-1111-5678",
      birthDate: "1955-03-12",
      position: "",
      password,
    });
    assert.equal(response.status, 400);
    assert.doesNotMatch(await response.text(), new RegExp(password));
  }

  const baseMember = {
    name: "  홍길동  ",
    phone: "010-1111-5678",
    birthDate: "1956-02-29",
    position: "집사",
    password: "482915",
  };
  const baseSignup = await signupMember(baseMember);
  assert.equal(baseSignup.status, 201);
  const basePayload = await baseSignup.json();
  assert.equal(basePayload.username, "홍길동");
  assert.doesNotMatch(JSON.stringify(basePayload), /482915/);

  const simultaneous = await Promise.all([
    signupMember(baseMember),
    signupMember(baseMember),
  ]);
  assert.deepEqual(simultaneous.map((response) => response.status), [201, 201]);
  const generatedLogins = [
    basePayload.username,
    ...(await Promise.all(simultaneous.map((response) => response.json()))).map(
      (payload) => payload.username,
    ),
  ];
  assert.equal(new Set(generatedLogins).size, 3);
  assert.deepEqual(new Set(generatedLogins), new Set(["홍길동", "홍길동5678", "홍길동5678-2"]));

  const membersResponse = await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } });
  assert.equal(membersResponse.status, 200);
  const members = (await membersResponse.json()).members;
  const created = members.find((member) => member.username === "홍길동");
  assert.ok(created);
  assert.equal(created.name, "홍길동");
  assert.equal(created.birthDate, "1956-02-29");
  assert.deepEqual(created.duplicateCheck.matchedFields, ["phone", "birthDate"]);
  assert.equal(created.duplicateCheck.matches.length, 2);
  assert.ok(created.duplicateCheck.matches.every((match) => match.matchedFields.join(",") === "phone,birthDate"));
  assert.ok(members.some((member) => member.username === "worship-user"));

  const uniqueUpdate = await request("/api/admin/members", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: websiteAdminCookie },
    body: JSON.stringify({ id: created.id, member: { phone: "010-7777-1212", birthDate: "1977-12-12" } }),
  });
  assert.equal(uniqueUpdate.status, 200);
  const uniqueMembers = (await (await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } })).json()).members;
  assert.equal(uniqueMembers.find((member) => member.id === created.id).duplicateCheck, null);
  const duplicateUpdate = await request("/api/admin/members", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: websiteAdminCookie },
    body: JSON.stringify({ id: created.id, member: { phone: baseMember.phone, birthDate: baseMember.birthDate } }),
  });
  assert.equal(duplicateUpdate.status, 200);

  const pendingLogin = await loginMember("홍길동", "482915", "198.51.100.11");
  assert.equal(pendingLogin.status, 401, "same-name accounts with the same password must not select the first signup");
  assert.equal(pendingLogin.headers.get("set-cookie"), null);
  const specificPendingLogin = await loginMember("홍길동5678", "482915", "198.51.100.11");
  assert.equal(specificPendingLogin.status, 200);
  assert.match(specificPendingLogin.headers.get("set-cookie") ?? "", /mhji_member_session=/);
  const pendingLoginPayload = await specificPendingLogin.json();
  assert.equal(pendingLoginPayload.approvalPending, true);
  const unknownLogin = await loginMember("존재하지않는회원", "482915", "198.51.100.12");
  assert.equal(unknownLogin.status, 401);
  assert.match((await unknownLogin.json()).error, /로그인 정보를 확인/);

  const approve = await request("/api/admin/members", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: websiteAdminCookie },
    body: JSON.stringify({ id: created.id, member: { status: "approved" } }),
  });
  assert.equal(approve.status, 200);
  const duplicateApproval = await approve.json();
  assert.equal(duplicateApproval.requiresDuplicateConfirmation, true);
  assert.match(duplicateApproval.error, /중복 가입 가능성/);
  assert.equal(duplicateApproval.duplicateCheck.matches.length, 2);
  const staleApprove = await request("/api/admin/members", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: websiteAdminCookie },
    body: JSON.stringify({
      id: created.id,
      member: { status: "approved" },
      duplicateFingerprint: "stale-local-fingerprint",
    }),
  });
  assert.equal(staleApprove.status, 200);
  const staleApprovalPayload = await staleApprove.json();
  assert.equal(staleApprovalPayload.requiresDuplicateConfirmation, true);
  assert.equal(staleApprovalPayload.duplicateCheck.fingerprint, duplicateApproval.duplicateCheck.fingerprint);
  const confirmedApprove = await request("/api/admin/members", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: websiteAdminCookie },
    body: JSON.stringify({
      id: created.id,
      member: { status: "approved" },
      duplicateFingerprint: duplicateApproval.duplicateCheck.fingerprint,
    }),
  });
  assert.equal(confirmedApprove.status, 200);
  assert.equal((await loginMember("홍길동", "482915", "198.51.100.11")).status, 401);
  const distinguishApproved = await request("/api/admin/members", { method: "PATCH", headers: { "content-type": "application/json", cookie: websiteAdminCookie }, body: JSON.stringify({ id: created.id, action: "reset-password" }) });
  assert.equal(distinguishApproved.status, 200);
  const approvedTemporary = (await distinguishApproved.json()).temporaryPassword;
  const approvedLogin = await loginMember("홍길동", approvedTemporary, "198.51.100.11");
  assert.equal(approvedLogin.status, 200);
  assert.equal((await approvedLogin.clone().json()).approvalPending, false);
  const approvedLoginText = await approvedLogin.text();
  assert.doesNotMatch(approvedLoginText, /482915/);
  assert.equal((await request("/api/admin/members")).status, 403);
  assert.doesNotMatch(approvedLoginText, /duplicateCheck|duplicateCount|중복 가입/);
});

test("member merges preserve aliases, unify sessions, rotate passwords, and roll back atomically", async () => {
  const beforePayload = await (await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } })).json();
  const beforeSummary = beforePayload.duplicateSummary;
  const fixtures = [
    { username: "merge-g1-a", password: "merge-pass-a1", name: "가상일번", phone: "010-7101-1001", birthDate: "1971-01-01" },
    { username: "merge-g1-b", password: "merge-pass-b1", name: "가상일번", phone: "010-7101-1001", birthDate: "1972-02-02" },
    { username: "merge-g2-a", password: "merge-pass-a2", name: "가상이번", phone: "010-7202-2001", birthDate: "1982-03-03" },
    { username: "merge-g2-b", password: "merge-pass-b2", name: "가상이번", phone: "010-7202-2002", birthDate: "1982-03-03" },
    { username: "merge-g3-a", password: "merge-pass-a3", name: "가상이름A", phone: "010-7303-3003", birthDate: "1990-04-04" },
    { username: "merge-g3-b", password: "merge-pass-b3", name: "가상이름B", phone: "010 7303 3003", birthDate: "1991-05-05" },
    { username: "merge-g3-c", password: "merge-pass-c3", name: "가상이름C", phone: "010-7303-3999", birthDate: "1991-05-05" },
  ];
  for (const fixture of fixtures) {
    const response = await signupMember({ ...fixture, position: fixture.username.endsWith("c") ? "집사 / 남전도회" : "집사" });
    assert.equal(response.status, 201, `${fixture.username}: ${await response.clone().text()}`);
  }

  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    const listed = await (await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } })).json();
    const byUsername = new Map(listed.members.map((member) => [member.username, member]));
    for (const fixture of fixtures) assert.ok(byUsername.get(fixture.username));
    const ids = Object.fromEntries(fixtures.map((fixture) => [fixture.username, byUsername.get(fixture.username).id]));
    await client.batch([
      { sql: "UPDATE members SET status = 'approved', created_at = '2026-01-01 00:00:00' WHERE id = ?", args: [ids["merge-g3-a"]] },
      { sql: "UPDATE members SET status = 'approved', created_at = '2026-01-02 00:00:00' WHERE id = ?", args: [ids["merge-g3-b"]] },
      { sql: "UPDATE members SET status = 'approved', created_at = '2026-01-03 00:00:00' WHERE id = ?", args: [ids["merge-g3-c"]] },
      { sql: "UPDATE members SET status = 'approved' WHERE id IN (?, ?)", args: [ids["merge-g2-a"], ids["merge-g2-b"]] },
      { sql: "UPDATE members SET status = 'suspended' WHERE id = ?", args: [ids["merge-g1-b"]] },
      { sql: "UPDATE members SET phone = '+82 10 7101 1001' WHERE id = ?", args: [ids["merge-g1-b"]] },
      { sql: `INSERT INTO business_applications
        (id, member_id, applicant_name, applicant_phone, business_name, category, owner_name, address, description)
        VALUES ('merge-business-record', ?, '가상 신청자', '010-7303-3003', '가상 사업장', '기타', '가상 대표', '가상 주소', '가상 설명')`, args: [ids["merge-g3-a"]] },
    ], "write");

    const grouped = await (await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } })).json();
    assert.deepEqual(grouped.duplicateSummary, {
      groupCount: beforeSummary.groupCount + 3,
      accountCount: beforeSummary.accountCount + 7,
      additionalCount: beforeSummary.additionalCount + 4,
    });
    const group3 = grouped.duplicateGroups.find((group) => group.accounts.some((account) => account.username === "merge-g3-a"));
    assert.ok(group3);
    assert.equal(group3.accounts.length, 3);
    assert.equal(group3.differentNames, true);
    assert.equal(new Set(grouped.duplicateGroups.flatMap((group) => group.accounts.map((account) => account.id))).size, grouped.duplicateSummary.accountCount);

    assert.equal((await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preview", groupId: group3.id }) })).status, 403);
    assert.equal((await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", cookie: websiteAdminCookie }, body: JSON.stringify({ action: "preview", groupId: group3.id }) })).status, 403);
    assert.equal((await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: "https://malicious.invalid", cookie: websiteAdminCookie }, body: JSON.stringify({ action: "preview", groupId: group3.id }) })).status, 403);
    const previewResponse = await request("/api/admin/members/merge", {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie },
      body: JSON.stringify({ action: "preview", groupId: group3.id }),
    });
    assert.equal(previewResponse.status, 200);
    const preview = (await previewResponse.json()).preview;
    assert.equal(preview.recommendedRepresentativeId, ids["merge-g3-a"]);
    assert.equal(preview.recommendedProfile.name, "가상이름C");
    assert.equal(preview.recordSummary.businessApplications, 1);
    assert.deepEqual(preview.blockedReasons, []);

    const preMergeLogins = [];
    for (const fixture of fixtures.slice(4)) {
      const response = await loginMember(fixture.username, fixture.password, `198.51.100.${40 + preMergeLogins.length}`);
      assert.equal(response.status, 200);
      preMergeLogins.push((response.headers.get("set-cookie") ?? "").split(";")[0]);
    }
    assert.equal((await loginMember("merge-g3-a", "merge-pass-b3", "198.51.100.60")).status, 401);

    const mergePayload = {
      action: "merge",
      groupId: group3.id,
      fingerprint: preview.fingerprint,
      representativeMemberId: preview.recommendedRepresentativeId,
      profile: preview.recommendedProfile,
    };
    const mergeResponse = await request("/api/admin/members/merge", {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie },
      body: JSON.stringify(mergePayload),
    });
    assert.equal(mergeResponse.status, 201);
    const merged = await mergeResponse.json();
    assert.equal(merged.representativeMemberId, ids["merge-g3-a"]);
    assert.equal(merged.aliasCount, 3);
    assert.equal((await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify(mergePayload) })).status, 409);

    for (const oldCookie of preMergeLogins) {
      const session = await request("/api/session", { headers: { cookie: oldCookie } });
      assert.equal((await session.json()).authenticated, false);
    }
    const aliasCookies = new Map();
    for (const fixture of fixtures.slice(4)) {
      const response = await loginMember(fixture.username, fixture.password, `198.51.100.${70 + aliasCookies.size}`);
      assert.equal(response.status, 200);
      const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
      aliasCookies.set(fixture.username, cookie);
      const token = cookie.split("=")[1];
      assert.equal(token.split(".")[0], ids["merge-g3-a"]);
      assert.equal(token.split(".").length, 4);
      const profile = await (await request("/api/members/profile", { headers: { cookie } })).json();
      assert.equal(profile.member.name, "가상이름C");
      assert.equal(profile.member.username, "merge-g3-a");
    }
    assert.equal((await loginMember("merge-g3-a", "merge-pass-c3", "198.51.100.80")).status, 401);
    assert.equal((await loginMember("missing-merge-user", "merge-pass-a3", "198.51.100.81")).status, 401);

    // Canonical name accepts enabled group credentials. Old source names
    // accept only their own credential, never another source's password.
    for (const fixture of fixtures.slice(4)) {
      const nameLogin = await loginMember("가상이름C", fixture.password, "198.51.100.82");
      assert.equal(nameLogin.status, 200);
      assert.equal(nameLogin.headers.get("set-cookie").split("=")[1].split(".")[0], ids["merge-g3-a"]);
    }
    assert.equal((await loginMember("가상이름B", "merge-pass-b3", "198.51.100.83")).status, 200);
    assert.equal((await loginMember("가상이름B", "merge-pass-a3", "198.51.100.83")).status, 401);
    const recoverMerged = await request("/api/members/recovery", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, "x-forwarded-for": "198.51.100.84" }, body: JSON.stringify({ name: "가상이름B", birthDate: "910505" }) });
    assert.equal(recoverMerged.status, 200);
    assert.equal(String((await client.execute("SELECT member_id FROM member_recovery_grants")).rows[0].member_id), ids["merge-g3-a"]);

    const passwordChange = await request("/api/members/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: aliasCookies.get("merge-g3-b") },
      body: JSON.stringify({ action: "password", currentPassword: "merge-pass-b3", password: "merged-new-password" }),
    });
    assert.equal(passwordChange.status, 200);
    for (const fixture of fixtures.slice(4)) assert.equal((await loginMember(fixture.username, fixture.password, `198.51.100.${90 + fixtures.indexOf(fixture)}`)).status, 401);
    for (const fixture of fixtures.slice(4)) assert.equal((await loginMember(fixture.username, "merged-new-password", `198.51.100.${100 + fixtures.indexOf(fixture)}`)).status, 200);

    const reset = await request("/api/admin/members", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: websiteAdminCookie },
      body: JSON.stringify({ id: ids["merge-g3-a"], action: "reset-password" }),
    });
    assert.equal(reset.status, 200);
    const temporaryPassword = (await reset.json()).temporaryPassword;
    assert.ok(temporaryPassword);
    assert.equal((await loginMember("merge-g3-a", "merged-new-password", "198.51.100.110")).status, 401);
    for (const fixture of fixtures.slice(4)) assert.equal((await loginMember(fixture.username, temporaryPassword, `198.51.100.${120 + fixtures.indexOf(fixture)}`)).status, 200);

    const disableAlias = await request("/api/admin/members/merge", {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie },
      body: JSON.stringify({ action: "alias", representativeMemberId: ids["merge-g3-a"], username: "merge-g3-b", enabled: false }),
    });
    assert.equal(disableAlias.status, 200);
    assert.equal((await loginMember("merge-g3-b", temporaryPassword, "198.51.100.130")).status, 401);
    assert.equal((await loginMember("merge-g3-a", temporaryPassword, "198.51.100.131")).status, 200);

    const preserved = await client.execute({ sql: "SELECT member_id FROM business_applications WHERE id = 'merge-business-record'", args: [] });
    assert.equal(String(preserved.rows[0].member_id), ids["merge-g3-a"]);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS count FROM member_merge_accounts WHERE merge_id = ?", args: [merged.mergeId] })).rows[0].count), 3);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS count FROM member_login_aliases WHERE representative_member_id = ?", args: [ids["merge-g3-a"]] })).rows[0].count), 3);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS count FROM member_app_access WHERE member_id = ?", args: [ids["merge-g3-a"]] })).rows[0].count), 0);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS count FROM admin_audit_logs WHERE action IN ('member.merge', 'member.password_change', 'member.password_reset') AND target_id IN (?, ?)", args: [merged.mergeId, ids["merge-g3-a"]] })).rows[0].count), 3);

    const afterMergeList = await (await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } })).json();
    assert.equal(afterMergeList.members.filter((member) => ["merge-g3-a", "merge-g3-b", "merge-g3-c"].includes(member.username)).length, 1);
    assert.equal(afterMergeList.members.find((member) => member.username === "merge-g3-a").loginAliases.length, 3);

    const group2 = afterMergeList.duplicateGroups.find((group) => group.accounts.some((account) => account.username === "merge-g2-a"));
    const group2Preview = (await (await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify({ action: "preview", groupId: group2.id }) })).json()).preview;
    await client.execute({ sql: `INSERT INTO member_login_aliases
      (username, source_member_id, representative_member_id, password_hash, password_salt)
      SELECT username, id, id, password_hash, password_salt FROM members WHERE id = ?`, args: [ids["merge-g2-a"]] });
    const mergeGroupsBeforeFailure = Number((await client.execute("SELECT COUNT(*) AS count FROM member_merge_groups")).rows[0].count);
    const failedMerge = await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify({ action: "merge", groupId: group2.id, fingerprint: group2Preview.fingerprint, representativeMemberId: group2Preview.recommendedRepresentativeId, profile: group2Preview.recommendedProfile }) });
    assert.equal(failedMerge.status, 409);
    assert.equal(Number((await client.execute("SELECT COUNT(*) AS count FROM member_merge_groups")).rows[0].count), mergeGroupsBeforeFailure);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS count FROM member_merge_accounts WHERE member_id IN (?, ?)", args: [ids["merge-g2-a"], ids["merge-g2-b"]] })).rows[0].count), 0);
    await client.execute({ sql: "DELETE FROM member_login_aliases WHERE source_member_id = ?", args: [ids["merge-g2-a"]] });
    await client.execute({ sql: "INSERT INTO member_app_access (member_id, app_code, access_level) VALUES (?, 'worship_archive', 'full')", args: [ids["merge-g2-a"]] });
    const blockedPreview = (await (await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify({ action: "preview", groupId: group2.id }) })).json()).preview;
    assert.match(blockedPreview.blockedReasons.join(" "), /특별 권한/);

    const group1 = (await (await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } })).json()).duplicateGroups.find((group) => group.accounts.some((account) => account.username === "merge-g1-a"));
    const group1Preview = (await (await request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify({ action: "preview", groupId: group1.id }) })).json()).preview;
    const group1Payload = { action: "merge", groupId: group1.id, fingerprint: group1Preview.fingerprint, representativeMemberId: group1Preview.recommendedRepresentativeId, profile: group1Preview.recommendedProfile };
    const concurrent = await Promise.all([1, 2].map(() => request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify(group1Payload) })));
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
    assert.equal((await loginMember("merge-g1-b", "merge-pass-b1", "198.51.100.140")).status, 401);

    const sharedRateIp = "198.51.100.199";
    for (const username of ["merge-g3-a", "merge-g3-b", "merge-g3-c", "merge-g3-a"]) {
      assert.equal((await loginMember(username, "wrong-merged-password", sharedRateIp)).status, 401);
    }
    const sharedBlock = await loginMember("merge-g3-c", "wrong-merged-password", sharedRateIp);
    assert.equal(sharedBlock.status, 429);
    assert.ok(Number(sharedBlock.headers.get("retry-after")) > 0);
  } finally {
    await client.close();
  }
});

test("member login throttling survives requests without exposing raw identifiers", async () => {
  const forwardedFor = "203.0.113.77";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await loginMember("없는회원", "000000", forwardedFor);
    assert.equal(response.status, 401);
  }
  const blocked = await loginMember("없는회원", "000000", forwardedFor);
  assert.equal(blocked.status, 429);
  assert.equal(Number(blocked.headers.get("retry-after")), 300);
  assert.doesNotMatch(await blocked.text(), /없는회원|203\.0\.113\.77/);

  const db = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    const rows = await db.execute("SELECT rate_key FROM member_login_attempts");
    assert.ok(rows.rows.length >= 1);
    for (const row of rows.rows) {
      assert.match(String(row.rate_key), /^[a-f0-9]{64}$/);
      assert.doesNotMatch(String(row.rate_key), /없는회원|203\.0\.113\.77/);
    }
  } finally {
    db.close();
  }
});

test("five-minute member blocks keep their deadline, preserve the failure window, and clear after a successful login", async () => {
  const ip = "198.51.100.201";
  const username = "worship-user";
  const key = createHash("sha256").update(`member:${memberIds[username]}\n${ip}`).digest("hex");
  const db = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  const attempt = () => db.execute({ sql: "SELECT failed_count, blocked_until, updated_at FROM member_login_attempts WHERE rate_key = ?", args: [key] });
  try {
    for (let index = 0; index < 4; index += 1) assert.equal((await loginMember(username, "wrong-password", ip)).status, 401);
    const fifth = await loginMember(username, "wrong-password", ip);
    assert.equal(fifth.status, 429);
    assert.equal(fifth.headers.get("retry-after"), "300");
    assert.match((await fifth.json()).error, /로그인 시도가 많아 일시적으로 제한되었습니다\. 5분 0초/);
    const initial = (await attempt()).rows[0];
    assert.equal(Number(initial.failed_count), 5);
    assert.equal(Number(initial.blocked_until) - Number(initial.updated_at), 300_000);

    // Move only the temporary database clock one second into the block.
    const shiftedNow = Date.now();
    await db.execute({ sql: "UPDATE member_login_attempts SET blocked_until = ?, updated_at = ? WHERE rate_key = ?", args: [shiftedNow + 299_000, shiftedNow - 1000, key] });
    const active = (await attempt()).rows[0];
    for (const password of ["wrong-password", "local-test-password"]) {
      const retry = await loginMember(username, password, ip);
      assert.equal(retry.status, 429);
      assert.equal(retry.headers.get("set-cookie"), null);
      const seconds = Number(retry.headers.get("retry-after"));
      assert.ok(seconds > 295 && seconds <= 299);
      assert.equal((await retry.json()).error, `로그인 시도가 많아 일시적으로 제한되었습니다. ${Math.floor(seconds / 60)}분 ${seconds % 60}초 후 다시 시도해 주세요.`);
      assert.deepEqual((await attempt()).rows[0], active);
    }
    assert.equal((await loginMember(username, "local-test-password", "198.51.100.202")).status, 200);
    assert.equal((await loginMember("full-user", "local-test-password", ip)).status, 200);
    assert.deepEqual((await attempt()).rows[0], active);

    // Five minutes have elapsed; a correct password now succeeds and clears
    // this account/IP's persisted failure record.
    const expiredNow = Date.now();
    await db.execute({ sql: "UPDATE member_login_attempts SET blocked_until = ?, updated_at = ? WHERE rate_key = ?", args: [expiredNow - 1, expiredNow - 300_001, key] });
    assert.equal((await loginMember(username, "local-test-password", ip)).status, 200);
    assert.equal((await attempt()).rows.length, 0);
    assert.equal((await loginMember(username, "wrong-password", ip)).status, 401);
    assert.equal(Number((await attempt()).rows[0].failed_count), 1);
    assert.equal((await loginMember(username, "local-test-password", ip)).status, 200);
    assert.equal((await attempt()).rows.length, 0);

    for (const [minutes, expectedStatus, expectedFailures] of [[14, 429, 5], [16, 401, 1]]) {
      await db.execute({ sql: "INSERT INTO member_login_attempts (rate_key, failed_count, blocked_until, updated_at) VALUES (?, 4, 0, ?) ON CONFLICT(rate_key) DO UPDATE SET failed_count = 4, blocked_until = 0, updated_at = excluded.updated_at", args: [key, Date.now() - minutes * 60_000] });
      assert.equal((await loginMember(username, "wrong-password", ip)).status, expectedStatus);
      assert.equal(Number((await attempt()).rows[0].failed_count), expectedFailures);
    }
  } finally { db.close(); }
});

test("existing fifteen-minute member blocks remain authoritative without rewriting production records", async () => {
  const ip = "198.51.100.203";
  const key = createHash("sha256").update(`member:${memberIds["worship-user"]}\n${ip}`).digest("hex");
  const db = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    const now = Date.now();
    await db.execute({ sql: "INSERT INTO member_login_attempts (rate_key, failed_count, blocked_until, updated_at) VALUES (?, 5, ?, ?)", args: [key, now + 900_000, now] });
    const before = (await db.execute({ sql: "SELECT * FROM member_login_attempts WHERE rate_key = ?", args: [key] })).rows[0];
    for (const password of ["wrong-password", "local-test-password"]) {
      const response = await loginMember("worship-user", password, ip);
      assert.equal(response.status, 429);
      const seconds = Number(response.headers.get("retry-after"));
      assert.ok(seconds > 890 && seconds <= 900);
      assert.match((await response.json()).error, /로그인 시도가 많아 일시적으로 제한/);
      assert.deepEqual((await db.execute({ sql: "SELECT * FROM member_login_attempts WHERE rate_key = ?", args: [key] })).rows[0], before);
    }
  } finally { db.close(); }
});

test("archive pages and metadata require an assigned archive level", async () => {
  assert.equal((await request("/api/archive/videos")).status, 403);
  assert.equal((await request("/api/archive/videos", { headers: { cookie: memberCookie(memberIds["none-user"]) } })).status, 403);
  assert.equal((await request("/api/archive/videos", { headers: { cookie: memberCookie(memberIds["pending-user"]) } })).status, 403);

  const listResponse = await request("/api/archive/videos", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(listResponse.status, 200);
  const listText = await listResponse.text();
  for (const id of Object.values(TEST_YOUTUBE_IDS)) assert.doesNotMatch(listText, new RegExp(id));
  assert.doesNotMatch(listText, /youtu(?:\.be|be\.com)|youtube-nocookie|embedUrl|youtubeUrl|youtubeId/i);

  const anonymousPage = await request("/archive", { redirect: "manual" });
  assert.equal(anonymousPage.status, 307);
  assert.match(anonymousPage.headers.get("location") ?? "", /\/member\/login\?return_to=%2Farchive/);
  const deniedPage = await request("/archive", { headers: { cookie: memberCookie(memberIds["none-user"]) }, redirect: "manual" });
  assert.equal(deniedPage.status, 307);
  assert.match(deniedPage.headers.get("location") ?? "", /\/archive\/access-required/);
  const accessRequiredPage = await request("/archive/access-required", { headers: { cookie: memberCookie(memberIds["none-user"]) } });
  assert.equal(accessRequiredPage.status, 200);
  const accessRequiredHtml = await accessRequiredPage.text();
  assert.match(accessRequiredHtml, /예배 아카이브 열람 권한이 필요합니다/);
  assert.match(accessRequiredHtml, /예배 아카이브는 별도 권한이 부여된 회원만 이용할 수 있습니다/);
  assert.doesNotMatch(accessRequiredHtml, /site-header|archive-app-header|<footer/);

  const pageResponse = await request("/archive", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(pageResponse.status, 200);
  const html = await pageResponse.text();
  for (const id of Object.values(TEST_YOUTUBE_IDS)) assert.doesNotMatch(html, new RegExp(id));
  assert.doesNotMatch(html, /youtube-nocookie|embedUrl|youtubeUrl|youtubeId/i);

  for (const route of ["/archive/sunday", "/archive/other", "/archive/attendance"]) {
    const sectionResponse = await request(route, { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
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
  const worshipPlaybackBody = await worshipPlayback.json();
  assert.match(worshipPlaybackBody.embedUrl, new RegExp(TEST_YOUTUBE_IDS.worship));
  assert.equal(worshipPlaybackBody.video.id, "worship-video");
  assert.equal(worshipPlaybackBody.video.title, "테스트 예배");
  assert.equal(worshipPlaybackBody.video.youtubeId, undefined);
  assert.match(worshipPlayback.headers.get("cache-control") ?? "", /private, no-store/);
  assert.equal((await request("/api/archive/videos/attendance-video/playback", { headers: { cookie: memberCookie(memberIds["worship-user"]) } })).status, 403);
  assert.equal((await request("/api/archive/videos/attendance-video/playback", { headers: { cookie: memberCookie(memberIds["full-user"]) } })).status, 200);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["force-user"]) } })).status, 401);
  const forceLogin = await loginMember("force-user", forceTemporaryPassword, "198.51.100.150");
  assert.equal(forceLogin.status, 200);
  const forceCookie = (forceLogin.headers.get("set-cookie") ?? "").split(";")[0];
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: forceCookie } })).status, 403);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["pending-user"]) } })).status, 403);
  assert.equal((await request("/api/archive/videos/worship-video/playback", { headers: { cookie: memberCookie(memberIds["suspended-user"]) } })).status, 401);

  const pendingAccess = await request("/api/archive/access", { headers: { cookie: memberCookie(memberIds["pending-user"]) } });
  assert.equal(pendingAccess.status, 200);
  assert.deepEqual(await pendingAccess.json(), {
    authenticated: true,
    approvalPending: true,
    member: { name: "대기회원", position: "" },
    level: "none",
    songStatsAllowed: false,
  });
});

test("archive thumbnails require access and attendance faces respect the assigned level", async () => {
  assert.equal((await request("/api/archive/videos/attendance-video/thumbnail")).status, 403);
  const response = await request("/api/archive/videos/attendance-video/thumbnail", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/);
  const body = await response.text();
  assert.match(body, /승인된 회원/);
  assert.doesNotMatch(body, new RegExp(TEST_YOUTUBE_IDS.attendance));
});

test("archive administration menu and server access are scoped to the configured archive admin", async () => {
  const signedOutPage = await request("/archive/admin", { redirect: "manual" });
  assert.match(signedOutPage.headers.get("location") ?? "", /\/admin\/login\?return_to=/);

  const websitePage = await request("/archive/admin", {
    headers: { cookie: websiteAdminCookie },
    redirect: "manual",
  });
  assert.match(websitePage.headers.get("location") ?? "", /\/admin$/);

  const websiteHome = await request("/admin", { headers: { cookie: websiteAdminCookie } });
  assert.equal(websiteHome.status, 200);
  const websiteHomeHtml = await websiteHome.text();
  assert.doesNotMatch(websiteHomeHtml, /아카이브 관리|활동 기록/);
  const websiteActivityPage = await request("/admin/activity", { headers: { cookie: websiteAdminCookie }, redirect: "manual" });
  assert.equal(websiteActivityPage.status, 307);
  assert.match(websiteActivityPage.headers.get("location") ?? "", /\/admin$/);
  assert.equal((await request("/api/admin/activity", { headers: { cookie: websiteAdminCookie } })).status, 403);

  const archivePortal = await request("/admin", { headers: { cookie: adminCookie } });
  assert.equal(archivePortal.status, 200);
  const archivePortalHtml = await archivePortal.text();
  for (const label of ["관리자 홈", "주보 관리", "교회소식 관리", "갤러리 관리", "성도사업장 관리", "회원 관리", "활동 기록", "아카이브 관리"]) {
    assert.match(archivePortalHtml, new RegExp(label));
  }
  assert.match(archivePortalHtml, /운영 현황/);
  assert.doesNotMatch(archivePortalHtml, /예배 아카이브 관리/);

  const archivePage = await request("/archive/admin", { headers: { cookie: adminCookie } });
  assert.equal(archivePage.status, 200);
  const archivePageHtml = await archivePage.text();
  assert.match(archivePageHtml, /홈페이지 관리/);
  assert.match(archivePageHtml, /href="\/admin"/);

  for (const pathname of ["/api/admin/members", "/api/admin/posts", "/api/admin/activity"]) {
    assert.equal((await request(pathname, { headers: { cookie: adminCookie } })).status, 200);
  }
  assert.equal((await request("/api/admin/archive/videos", { headers: { cookie: websiteAdminCookie } })).status, 403);
  assert.equal((await request("/api/admin/archive/videos", { headers: { cookie: legacyArchiveAdminCookie() } })).status, 403);
  assert.equal((await request("/api/admin/archive/videos", { headers: { cookie: adminCookie } })).status, 200);
  assert.equal((await request("/api/admin/activity")).status, 403);

  const logout = await request("/api/admin/session?return_to=/archive", {
    headers: { cookie: adminCookie },
    redirect: "manual",
  });
  assert.match(logout.headers.get("set-cookie") ?? "", /mhji_admin_session=;/);
  assert.equal((await request("/api/admin/archive/videos", { headers: { cookie: "mhji_admin_session=" } })).status, 403);
});

test("successful administrator and member logins show validated IP and device only to the archive administrator", async () => {
  const adminLogin = await request("/api/admin/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nf-client-connection-ip": "198.51.100.12",
      "x-forwarded-for": "203.0.113.99",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
    },
    body: JSON.stringify({ username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD }),
  });
  assert.equal(adminLogin.status, 200);
  const memberLogin = await request("/api/members/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.24",
      "user-agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    },
    body: JSON.stringify({ username: "worship-user", password: "local-test-password" }),
  });
  assert.equal(memberLogin.status, 200);

  const adminLogsResponse = await request("/api/admin/activity?action=admin.login", { headers: { cookie: adminCookie } });
  assert.equal(adminLogsResponse.status, 200);
  const adminLogs = (await adminLogsResponse.json()).logs;
  const matchingAdminLogin = adminLogs.find((log) => log.actorId === TEST_ADMIN_USERNAME && log.metadata.ipAddress === "198.51.100.12");
  assert.equal(matchingAdminLogin?.metadata.device, "PC · macOS · Safari");
  assert.deepEqual(Object.keys(matchingAdminLogin.metadata).sort(), ["device", "ipAddress"]);

  const memberLogsResponse = await request("/api/admin/activity?action=member.login", { headers: { cookie: adminCookie } });
  assert.equal(memberLogsResponse.status, 200);
  const memberLogs = (await memberLogsResponse.json()).logs;
  const matchingMemberLogin = memberLogs.find((log) => log.actorId === memberIds["worship-user"] && log.metadata.ipAddress === "203.0.113.24");
  assert.equal(matchingMemberLogin?.actorName, "예배회원");
  assert.equal(matchingMemberLogin?.metadata.device, "모바일 · Android · Chrome");
  assert.equal((await request("/api/admin/activity?action=member.login", { headers: { cookie: websiteAdminCookie } })).status, 403);

  for (const [group, allowed] of [
    ["login", (action) => action === "admin.login" || action === "member.login"],
    ["member", (action) => action.startsWith("member.") && action !== "member.login"],
    ["content", (action) => action.startsWith("content.")],
    ["archive", (action) => action.startsWith("archive.")],
  ]) {
    const response = await request(`/api/admin/activity?group=${group}`, { headers: { cookie: adminCookie } });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.logs.every((log) => allowed(log.action)));
    if (group === "login") assert.ok(data.logs.some((log) => log.action === "member.login"));
  }
});

test("archive administration requires auth and local CRUD rejects unsafe input", async () => {
  assert.equal((await request("/api/admin/archive/videos")).status, 403);
  assert.equal((await request("/api/admin/archive/videos", { headers: { cookie: websiteAdminCookie } })).status, 403);
  assert.equal((await request("/api/admin/archive/videos", { headers: { cookie: legacyArchiveAdminCookie() } })).status, 403);
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

  const publicSearch = await request("/api/archive/videos?q=넘지%20못할", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(publicSearch.status, 200);
  const publicVideo = (await publicSearch.json()).videos.find((video) => video.id === "analysis-fixture-video");
  assert.equal(publicVideo.analysis, null);
  const playback = await request("/api/archive/videos/analysis-fixture-video/playback", { headers: { cookie: memberCookie(memberIds["worship-user"]) } });
  assert.equal(playback.status, 200);
  assert.equal((await playback.json()).video.analysis.songs.length, 3);
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

  const accessList = await request("/api/admin/archive/access", { headers: { cookie: adminCookie } });
  assert.equal(accessList.status, 200);
  assert.equal((await accessList.json()).members.find((member) => member.id === memberIds["worship-user"]).songStatsAllowed, true);

  const denySongStats = await request("/api/admin/archive/access", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ memberId: memberIds["worship-user"], songStatsAllowed: false }),
  });
  assert.equal(denySongStats.status, 200);
  assert.equal((await request("/api/archive/songs/stats", { headers: { cookie: memberCookie(memberIds["worship-user"]) } })).status, 403);
  const deniedSongPage = await request("/archive/songs", { headers: { cookie: memberCookie(memberIds["worship-user"]) }, redirect: "manual" });
  assert.equal(deniedSongPage.status, 307);
  assert.match(deniedSongPage.headers.get("location") ?? "", /\/archive\?access=songs-denied/);

  const allowSongStats = await request("/api/admin/archive/access", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: JSON.stringify({ memberId: memberIds["worship-user"], songStatsAllowed: true }),
  });
  assert.equal(allowSongStats.status, 200);
  assert.equal((await request("/api/archive/songs/stats", { headers: { cookie: memberCookie(memberIds["worship-user"]) } })).status, 200);
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

test("exact normalized names disambiguate passwords and share account limits with old usernames", async () => {
  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  const fixtures = [
    { username: "name-unique", name: "한글정규", password: "unique-name-password" },
    { username: "name-twin-a", name: "가상동명", password: "twin-a-password" },
    { username: "name-twin-b", name: "가상동명", password: "twin-b-password" },
    { username: "legacy-collision", name: "가상아이디", password: "legacy-collision-password" },
    { username: "name-collision", name: "legacy-collision", password: "other-person-password" },
  ];
  const ids = {};
  try {
    for (const fixture of fixtures) {
      const response = await signupMember({ ...fixture, phone: "010-8833-7733", birthDate: "1982-11-08", position: "" });
      assert.equal(response.status, 201);
      ids[fixture.username] = String((await client.execute({ sql: "SELECT id FROM members WHERE username = ?", args: [fixture.username] })).rows[0].id);
    }
    const loginId = async (name, password, ip = "198.51.100.180") => {
      const response = await loginMember(name, password, ip);
      assert.equal(response.status, 200);
      return (response.headers.get("set-cookie") ?? "").split("=")[1].split(".")[0];
    };
    assert.equal(await loginId("  한글정규  ".normalize("NFD"), fixtures[0].password), ids["name-unique"]);
    assert.equal(await loginId("가상동명", fixtures[1].password), ids["name-twin-a"]);
    assert.equal(await loginId("가상동명", fixtures[2].password), ids["name-twin-b"]);
    assert.equal(await loginId("legacy-collision", fixtures[3].password), ids["legacy-collision"]);
    assert.equal((await loginMember("legacy-collision", fixtures[4].password, "198.51.100.181")).status, 401);
    assert.equal((await loginMember("한글", fixtures[0].password, "198.51.100.182")).status, 401);
    const repeated = await signupMember({ username: "name-twin-c", name: "가상동명", password: fixtures[1].password, phone: "010-8833-7733", birthDate: "1982-11-08", position: "" });
    assert.equal(repeated.status, 201);
    const ambiguous = await loginMember("가상동명", fixtures[1].password, "198.51.100.183");
    assert.equal(ambiguous.status, 401);
    assert.equal(ambiguous.headers.get("set-cookie"), null);
    assert.doesNotMatch(await ambiguous.text(), /name-twin|가상동명|8833/);
    assert.equal(await loginId("name-twin-a", fixtures[1].password), ids["name-twin-a"]);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await loginMember(attempt % 2 ? "name-unique" : "한글정규", "wrong-password", "198.51.100.184");
      assert.equal(response.status, attempt < 4 ? 401 : 429);
      if (attempt === 4) assert.equal(response.headers.get("retry-after"), "300");
    }
    for (const name of ["한글정규", "name-unique"]) assert.equal((await loginMember(name, fixtures[0].password, "198.51.100.184")).status, 429);
    await client.execute({ sql: "UPDATE members SET status = 'suspended' WHERE id = ?", args: [ids["name-unique"]] });
    assert.equal((await loginMember("한글정규", fixtures[0].password, "198.51.100.185")).status, 401);
  } finally { client.close(); }
});

test("direct name and birth recovery uses private one-use grants without changing approval or exposing account matches", async () => {
  const client = createClient({ url: "file:" + databasePath.replaceAll("\\", "/") });
  const ids = {};
  const fixtures = [
    { username: "recover-zero", name: "가상영년", birthDate: "2000-01-02" },
    { username: "recover-empty", name: "가상미등록", birthDate: "" },
    { username: "recover-twin-a", name: "가상복구동명", birthDate: "1920-02-03" },
    { username: "recover-twin-b", name: "가상복구동명", birthDate: "2020-02-03" },
    { username: "recover-suspended", name: "가상중지복구", birthDate: "1982-11-08" },
    { username: TEST_ADMIN_USERNAME, name: "가상관리제외", birthDate: "1982-11-08" },
  ];
  let sequence = 0;
  const ip = () => "203.0.113." + (++sequence);
  const recover = (name, birthDate, address = ip(), extra = {}) => request("/api/members/recovery", {
    method: "POST", headers: { "content-type": "application/json", origin: baseUrl, "x-forwarded-for": address },
    body: JSON.stringify({ name, birthDate, ...extra }),
  });
  const complete = (cookie, password = "recover-new-password", address = ip(), extra = {}) => request("/api/members/recovery/complete", {
    method: "POST", headers: { "content-type": "application/json", origin: baseUrl, "x-forwarded-for": address, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ password, confirmation: password, ...extra }),
  });
  const recoveryCookie = response => (response.headers.get("set-cookie") ?? "").split(";")[0];
  try {
    for (const fixture of fixtures) {
      const response = await signupMember({ ...fixture, phone: "010-6622-1111", password: "recover-original-password", position: "" });
      assert.equal(response.status, 201);
      ids[fixture.username] = String((await client.execute({ sql: "SELECT id FROM members WHERE username = ?", args: [fixture.username] })).rows[0].id);
    }
    await client.execute({ sql: "UPDATE members SET status = 'suspended' WHERE id = ?", args: [ids["recover-suspended"]] });
    const before = await client.execute("SELECT id, password_hash, password_salt, status FROM members ORDER BY id");
    const beforeVersions = await client.execute("SELECT * FROM member_auth_state ORDER BY member_id");
    const bodies = [];
    const invalidCookies = [];
    let validCookie;
    for (const [name, hint] of [["가상영년", "000102"], ["가상영년", "001102"], ["가상미등록", "821108"], ["가상복구동명", "200203"], ["가상미존재", "821108"], ["가상중지복구", "821108"], ["가상관리제외", "821108"]]) {
      const response = await recover(name, hint);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /private, no-store/);
      assert.match(response.headers.get("set-cookie"), /HttpOnly/i);
      assert.match(response.headers.get("set-cookie"), /SameSite=Strict/i);
      assert.match(response.headers.get("set-cookie"), /Path=\/api\/members\/recovery/);
      assert.match(response.headers.get("set-cookie"), /Max-Age=300/i);
      assert.match(recoveryCookie(response), /^mhji_member_recovery=[A-Za-z0-9_-]{43}$/);
      bodies.push(await response.text());
      if (!validCookie) validCookie = recoveryCookie(response); else invalidCookies.push(recoveryCookie(response));
    }
    assert.equal(new Set(bodies).size, 1, "missing, ambiguous, blocked and valid hints return identical public responses");
    assert.doesNotMatch(bodies[0], /000102|821108|recover-zero|token|temporaryPassword/);
    const grants = await client.execute("SELECT * FROM member_recovery_grants");
    assert.equal(grants.rows.length, 1);
    assert.equal(grants.rows[0].member_id, ids["recover-zero"]);
    assert.equal(grants.rows[0].token_hash, createHash("sha256").update(validCookie.split("=")[1]).digest("hex"));
    assert.ok(Number(grants.rows[0].expires_at) > Date.now() && Number(grants.rows[0].expires_at) <= Date.now() + 300_000);
    for (const cookie of invalidCookies) assert.equal((await complete(cookie)).status, 400);
    assert.equal((await complete(null)).status, 400);
    assert.equal((await complete(validCookie, "recover-new-password", ip(), { memberId: ids["recover-empty"] })).status, 400);
    assert.equal((await recover("가상영년", "000102", ip(), { verified: true })).status, 400);
    assert.equal((await recover("가상영년", "00102")).status, 400);
    assert.deepEqual((await client.execute("SELECT id, password_hash, password_salt, status FROM members ORDER BY id")).rows, before.rows);
    assert.deepEqual((await client.execute("SELECT * FROM member_auth_state ORDER BY member_id")).rows, beforeVersions.rows);
    assert.equal((await request("/api/members/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "가상영년", birthDate: "000102", verified: true, password: "hijacked-password" }) })).status, 401);

    const newer = recoveryCookie(await recover("  가상영년  ".normalize("NFD"), "000102"));
    assert.equal((await complete(validCookie)).status, 400, "new grant replaces the old browser's grant");
    const oldLogin = await loginMember("recover-zero", "recover-original-password", ip());
    assert.equal(oldLogin.status, 200);
    const oldCookie = oldLogin.headers.get("set-cookie").split(";")[0];
    assert.equal((await complete(newer, "recover-new-password", ip(), { confirmation: "does-not-match" })).status, 400);
    const changed = await complete(newer);
    assert.equal(changed.status, 200);
    assert.deepEqual(await changed.json(), { ok: true });
    assert.match(changed.headers.get("cache-control"), /private, no-store/);
    assert.equal((await complete(newer, "should-not-replace-password")).status, 400, "grant is one-use");
    assert.equal((await request("/api/session", { headers: { cookie: oldCookie } }).then(r => r.json())).authenticated, false);
    assert.equal((await loginMember("recover-zero", "recover-original-password", ip())).status, 401);
    for (const login of ["recover-zero", "가상영년"]) {
      const response = await loginMember(login, "recover-new-password", ip());
      assert.equal(response.status, 200);
      assert.equal((await response.json()).approvalPending, true);
    }
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM member_recovery_grants WHERE member_id = ?", args: [ids["recover-zero"]] })).rows[0].n), 0);

    const expired = recoveryCookie(await recover("가상영년", "000102"));
    await client.execute({ sql: "UPDATE member_recovery_grants SET expires_at = ? WHERE member_id = ?", args: [Date.now() - 1, ids["recover-zero"]] });
    assert.equal((await complete(expired)).status, 400);
    const revoked = recoveryCookie(await recover("가상영년", "000102"));
    const adminReset = await request("/api/admin/members", { method: "PATCH", headers: { "content-type": "application/json", cookie: websiteAdminCookie }, body: JSON.stringify({ id: ids["recover-zero"], action: "reset-password" }) });
    assert.equal(adminReset.status, 200);
    assert.equal((await complete(revoked)).status, 400, "administrator password changes revoke outstanding grants");
    const rollback = recoveryCookie(await recover("가상영년", "000102"));
    const beforeRollback = await client.execute({ sql: "SELECT password_hash, force_password_change, status FROM members WHERE id = ?", args: [ids["recover-zero"]] });
    const versionBeforeRollback = await client.execute({ sql: "SELECT * FROM member_auth_state WHERE member_id = ?", args: [ids["recover-zero"]] });
    await client.execute("CREATE TRIGGER fail_direct_recovery BEFORE INSERT ON admin_audit_logs WHEN instr(NEW.metadata_json, 'name_birth_recovery') > 0 BEGIN SELECT RAISE(ABORT, 'test recovery audit failure'); END");
    assert.equal((await complete(rollback)).status, 503);
    assert.deepEqual((await client.execute({ sql: "SELECT password_hash, force_password_change, status FROM members WHERE id = ?", args: [ids["recover-zero"]] })).rows, beforeRollback.rows);
    assert.deepEqual((await client.execute({ sql: "SELECT * FROM member_auth_state WHERE member_id = ?", args: [ids["recover-zero"]] })).rows, versionBeforeRollback.rows);
    await client.execute("DROP TRIGGER fail_direct_recovery");
    assert.equal((await complete(rollback)).status, 200, "failed transaction does not consume its grant");
    const stateBeforeLimit = await client.execute({ sql: "SELECT password_hash, status FROM members WHERE id = ?", args: [ids["recover-zero"]] });
    for (let index = 0; index < 5; index += 1) assert.equal((await recover("가상영년", "000102", "203.0.113.230")).status, index < 4 ? 200 : 429);
    const blockedRow = await client.execute("SELECT * FROM member_login_attempts WHERE failed_count = 5 AND blocked_until > 0 ORDER BY rate_key");
    assert.equal((await recover("가상영년", "000102", "203.0.113.230")).status, 429);
    assert.deepEqual((await client.execute("SELECT * FROM member_login_attempts WHERE failed_count = 5 AND blocked_until > 0 ORDER BY rate_key")).rows, blockedRow.rows);
    assert.deepEqual((await client.execute({ sql: "SELECT password_hash, status FROM members WHERE id = ?", args: [ids["recover-zero"]] })).rows, stateBeforeLimit.rows);
    for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await complete("mhji_member_recovery=" + "x".repeat(43), "irrelevant-password", "203.0.113.231")).status, attempt < 4 ? 400 : 429);
    const stillValid = recoveryCookie(await recover("가상영년", "000102"));
    assert.equal((await complete(stillValid, "irrelevant-password", "203.0.113.231")).status, 429);
    assert.equal((await loginMember("recover-zero", "recover-new-password", "203.0.113.231")).status, 200, "reset rate limits never lock login");
    for (const path of ["/api/members/recovery", "/api/members/recovery/complete"]) {
      assert.equal((await request(path, { method: "POST", headers: { "content-type": "application/json", origin: "https://malicious.invalid" }, body: "{}" })).status, 403);
    }
    assert.equal((await request("/api/members/recovery", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl }, body: JSON.stringify({ name: "x".repeat(1500), birthDate: "000102" }) })).status, 413);
  } finally { client.close(); }
});

test("direct recovery rotates every merged alias atomically and preserves the representative status and permissions", async () => {
  const client = createClient({ url: "file:" + databasePath.replaceAll("\\", "/") });
  try {
    const a = await withdrawalFixture(client, "direct-merge-a", "직접병합A", "010-8899-6600");
    const b = await withdrawalFixture(client, "direct-merge-b", "직접병합B", "010-8899-6600");
    await client.execute({ sql: "UPDATE members SET birth_date = '1960-01-02' WHERE id IN (?, ?)", args: [a.id, b.id] });
    const collection = await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } }).then(r => r.json());
    const group = collection.duplicateGroups.find(item => item.accounts.some(account => account.id === a.id));
    assert.equal(group.accounts.length, 2);
    const merge = data => request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify(data) });
    const preview = (await (await merge({ action: "preview", groupId: group.id })).json()).preview;
    assert.equal((await merge({ action: "merge", groupId: group.id, fingerprint: preview.fingerprint, representativeMemberId: a.id, profile: preview.recommendedProfile })).status, 201);
    const oldCookies = [];
    for (const member of [a, b]) oldCookies.push((await loginMember(member.username, member.password, "203.0.113.232")).headers.get("set-cookie").split(";")[0]);
    const started = await request("/api/members/recovery", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, "x-forwarded-for": "203.0.113.232" }, body: JSON.stringify({ name: b.name, birthDate: "600102" }) });
    assert.equal(started.status, 200);
    const cookie = started.headers.get("set-cookie").split(";")[0];
    const finished = await request("/api/members/recovery/complete", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie, "x-forwarded-for": "203.0.113.232" }, body: JSON.stringify({ password: "merged-direct-new", confirmation: "merged-direct-new" }) });
    assert.equal(finished.status, 200);
    for (const member of [a, b]) {
      assert.equal((await loginMember(member.username, member.password, "203.0.113.233")).status, 401);
      const response = await loginMember(member.username, "merged-direct-new", "203.0.113.234");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("set-cookie").split("=")[1].split(".")[0], a.id);
    }
    for (const cookie of oldCookies) assert.equal((await request("/api/session", { headers: { cookie } }).then(r => r.json())).authenticated, false);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM members WHERE id IN (?, ?) AND status = 'pending'", args: [a.id, b.id] })).rows[0].n), 2);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM member_app_access WHERE member_id IN (?, ?)", args: [a.id, b.id] })).rows[0].n), 0);
  } finally { client.close(); }
});

function withdrawal(cookie, password, ip = "198.51.100.220", extra = {}, origin = baseUrl) {
  return request("/api/members/withdrawal", { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}), "x-forwarded-for": ip }, body: JSON.stringify({ password, confirmed: true, ...extra }) });
}

async function withdrawalFixture(client, username, name, phone = "010-8844-9944") {
  const password = `${username}-password`;
  assert.equal((await signupMember({ username, name, phone, birthDate: "1982-11-08", password, position: "집사" })).status, 201);
  const id = String((await client.execute({ sql: "SELECT id FROM members WHERE username = ?", args: [username] })).rows[0].id);
  const login = await loginMember(username, password, "198.51.100.219");
  assert.equal(login.status, 200);
  return { id, username, name, phone, password, cookie: login.headers.get("set-cookie").split(";")[0] };
}

test("member self withdrawal deletes credentials and private data, preserves redacted audit and unrelated public data", async () => {
  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    const member = await withdrawalFixture(client, "withdraw-self", "가상본인탈퇴");
    const other = await withdrawalFixture(client, "withdraw-other", "가상다른교인");
    const beforeOther = (await client.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [other.id] })).rows;
    assert.equal((await withdrawal(null, member.password)).status, 401);
    assert.equal((await withdrawal(adminCookie, member.password)).status, 401, "administrator cookie is not a member session");
    assert.equal((await withdrawal(member.cookie, member.password, undefined, { id: other.id })).status, 400);
    assert.equal((await withdrawal(member.cookie, member.password, undefined, { memberId: other.id })).status, 400);
    assert.equal((await withdrawal(member.cookie, member.password, undefined, { confirmed: false })).status, 400);
    assert.equal((await withdrawal(member.cookie, member.password, undefined, {}, "https://malicious.invalid")).status, 403);
    assert.equal((await withdrawal(member.cookie, member.password, undefined, {}, null)).status, 403);
    assert.equal((await withdrawal(member.cookie, "incorrect-password")).status, 401);
    assert.equal((await request("/api/session", { headers: { cookie: member.cookie } }).then(r => r.json())).authenticated, true);
    await client.execute({ sql: "INSERT INTO member_app_access (member_id, app_code, access_level) VALUES (?, 'worship_archive', 'full')", args: [member.id] });
    await client.execute({ sql: "INSERT INTO member_password_reset_requests (member_id) VALUES (?)", args: [member.id] });
    await client.execute({ sql: "INSERT INTO member_recovery_grants (token_hash, member_id, session_version, expires_at) VALUES (?, ?, 0, ?)", args: ["a".repeat(64), member.id, Date.now() + 300_000] });
    await client.execute({ sql: "INSERT INTO business_applications (id, member_id, applicant_name, applicant_phone, business_name, category, owner_name, address, description, admin_note) VALUES ('withdraw-application', ?, ?, ?, '가상 사업장', '기타', ?, '가상 주소', '가상 소개', ?)", args: [member.id, member.name, member.phone, member.name, member.name] });
    await client.execute("INSERT INTO content_posts (id, type, title, date, images) VALUES ('withdraw-public', 'gallery', '교회 공용 앨범', '2026.11.03', '[\"/assets/shared-photo.jpg\"]')");
    await client.execute({ sql: "INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, metadata_json) VALUES ('withdraw-old-audit', ?, 'member.password_change', 'member', ?, ?)", args: [member.id, member.id, JSON.stringify({ name: member.name, phone: member.phone, birthDate: "1982-11-08", aliasUsername: member.username, ipAddress: "198.51.100.220" })] });
    await client.execute({ sql: "INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, metadata_json) VALUES ('withdraw-legacy-username', ?, 'member.login', 'member', '', ?)", args: [member.username, JSON.stringify({ ipAddress: "198.51.100.220" })] });
    await client.execute({ sql: "INSERT INTO archive_audit_logs (id, actor, action, target_type, target_id, summary, details_json) VALUES ('withdraw-old-archive', 'archive-test-admin', 'access.update', 'member', ?, ?, ?)", args: [member.id, member.name, JSON.stringify({ name: member.name, phone: member.phone })] });
    const beforeCount = Number((await client.execute("SELECT COUNT(*) AS n FROM admin_audit_logs")).rows[0].n);
    const response = await withdrawal(member.cookie, member.password);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/i);
    for (const table of ["members", "member_app_access", "member_auth_state", "member_password_reset_requests", "member_recovery_grants", "business_applications"]) {
      const column = table === "members" ? "id" : "member_id";
      assert.equal(Number((await client.execute({ sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, args: [member.id] })).rows[0].n), 0);
    }
    assert.deepEqual((await client.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [other.id] })).rows, beforeOther);
    assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM content_posts WHERE id = 'withdraw-public' AND images = '[\"/assets/shared-photo.jpg\"]'")).rows[0].n), 1);
    assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM admin_audit_logs")).rows[0].n), beforeCount + 1);
    const event = (await client.execute("SELECT * FROM admin_audit_logs WHERE action = 'member.withdrawal' ORDER BY created_at DESC")).rows[0];
    assert.match(String(event.actor_id), /^withdrawn:/);
    assert.equal(event.actor_id, event.target_id);
    assert.deepEqual(JSON.parse(String(event.metadata_json)), { result: "success" });
    for (const sql of ["SELECT actor_id, target_id, metadata_json FROM admin_audit_logs WHERE id = 'withdraw-old-audit'", "SELECT actor_id, target_id, metadata_json FROM admin_audit_logs WHERE id = 'withdraw-legacy-username'", "SELECT actor, target_id, summary, details_json FROM archive_audit_logs WHERE id = 'withdraw-old-archive'"]) {
      const serialized = JSON.stringify((await client.execute(sql)).rows);
      for (const secret of [member.id, member.name, member.username, member.phone, "1982-11-08", "198.51.100.220"]) assert.equal(serialized.includes(secret), false);
    }
    assert.equal((await request("/api/session", { headers: { cookie: member.cookie } }).then(r => r.json())).authenticated, false);
    for (const login of [member.username, member.name]) assert.equal((await loginMember(login, member.password, "198.51.100.221")).status, 401);
    assert.equal((await withdrawal(member.cookie, member.password)).status, 401);
    const reset = await request("/api/members/recovery", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, "x-forwarded-for": "198.51.100.222" }, body: JSON.stringify({ name: member.name, birthDate: "821108" }) });
    assert.equal(reset.status, 200);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM member_password_reset_requests WHERE member_id = ?", args: [member.id] })).rows[0].n), 0);
    assert.equal((await request("/api/admin/activity", { headers: { cookie: other.cookie } })).status, 403);
    assert.equal((await request("/api/admin/activity", { headers: { cookie: websiteAdminCookie } })).status, 403);
    const history = await request("/api/admin/activity?action=member.withdrawal", { headers: { cookie: adminCookie } });
    assert.equal(history.status, 200);
    assert.ok((await history.json()).logs.some(log => log.action === "member.withdrawal"));
    const rejoined = await withdrawalFixture(client, member.username, member.name);
    assert.notEqual(rejoined.id, member.id);
    assert.equal(String((await client.execute({ sql: "SELECT status FROM members WHERE id = ?", args: [rejoined.id] })).rows[0].status), "pending");
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM member_app_access WHERE member_id = ?", args: [rejoined.id] })).rows[0].n), 0);
    assert.equal((await request("/api/session", { headers: { cookie: member.cookie } }).then(r => r.json())).authenticated, false);
  } finally { client.close(); }
});

test("withdrawal reauthentication has a separate persistent limit and retries never extend its deadline", async () => {
  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    const member = await withdrawalFixture(client, "withdraw-limit", "가상탈퇴제한");
    const ip = "198.51.100.223";
    const rateKey = createHash("sha256").update(`withdrawal:${member.id}\n${ip}`).digest("hex");
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await withdrawal(member.cookie, "incorrect-password", ip);
      assert.equal(response.status, attempt < 5 ? 401 : 429);
      if (attempt === 5) assert.equal(Number(response.headers.get("retry-after")), 300);
    }
    const before = await client.execute({ sql: "SELECT * FROM member_login_attempts WHERE rate_key = ?", args: [rateKey] });
    const restricted = await withdrawal(member.cookie, member.password, ip);
    assert.equal(restricted.status, 429);
    assert.deepEqual((await client.execute({ sql: "SELECT * FROM member_login_attempts WHERE rate_key = ?", args: [rateKey] })).rows, before.rows);
    assert.equal((await loginMember(member.name, member.password, ip)).status, 200, "withdrawal limit does not lock member login");
    await client.execute({ sql: "UPDATE member_login_attempts SET blocked_until = ? WHERE rate_key = ?", args: [Date.now() - 1, rateKey] });
    assert.equal((await withdrawal(member.cookie, member.password, ip)).status, 200);
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM member_login_attempts WHERE rate_key = ?", args: [rateKey] })).rows[0].n), 0);
  } finally { client.close(); }
});

test("withdrawal rolls back all deletion and audit redaction on failure and refuses unreviewed references", async () => {
  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    const member = await withdrawalFixture(client, "withdraw-rollback", "가상탈퇴복구");
    await client.execute({ sql: "INSERT INTO member_password_reset_requests (member_id) VALUES (?)", args: [member.id] });
    await client.execute({ sql: "INSERT INTO member_app_access (member_id, app_code, access_level) VALUES (?, 'worship_archive', 'full')", args: [member.id] });
    const before = {};
    for (const table of ["members", "member_password_reset_requests", "member_app_access", "admin_audit_logs"]) before[table] = (await client.execute(`SELECT * FROM ${table} ORDER BY 1`)).rows;
    await client.execute("CREATE TRIGGER fail_withdrawal_audit BEFORE INSERT ON admin_audit_logs WHEN NEW.action = 'member.withdrawal' BEGIN SELECT RAISE(ABORT, 'test audit unavailable'); END");
    const failed = await withdrawal(member.cookie, member.password);
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /test audit|sqlite|libsql|withdraw-rollback|password/i);
    for (const table of Object.keys(before)) assert.deepEqual((await client.execute(`SELECT * FROM ${table} ORDER BY 1`)).rows, before[table]);
    assert.equal((await request("/api/session", { headers: { cookie: member.cookie } }).then(r => r.json())).authenticated, true);
    await client.execute("DROP TRIGGER fail_withdrawal_audit");
    await client.execute("CREATE TABLE future_member_relation (member_id TEXT REFERENCES members(id) ON DELETE CASCADE)");
    await client.execute({ sql: "INSERT INTO future_member_relation (member_id) VALUES (?)", args: [member.id] });
    assert.equal((await withdrawal(member.cookie, member.password)).status, 503);
    assert.equal(Number((await client.execute("SELECT COUNT(*) AS n FROM future_member_relation")).rows[0].n), 1);
    await client.execute("DROP TABLE future_member_relation");
    assert.equal((await withdrawal(member.cookie, member.password)).status, 200);
  } finally { client.close(); }
});

test("merged withdrawal removes the entire merged identity and snapshots but preserves a merely duplicate account", async () => {
  const client = createClient({ url: `file:${databasePath.replaceAll("\\", "/")}` });
  try {
    const a = await withdrawalFixture(client, "withdraw-merge-a", "가상병합탈퇴A", "010-8811-2211");
    const b = await withdrawalFixture(client, "withdraw-merge-b", "가상병합탈퇴B", "010-8811-2211");
    await client.execute({ sql: "UPDATE members SET birth_date = '1970-01-01' WHERE id IN (?, ?)", args: [a.id, b.id] });
    const collection = await request("/api/admin/members", { headers: { cookie: websiteAdminCookie } }).then(r => r.json());
    const group = collection.duplicateGroups.find(group => group.accounts.some(account => account.id === a.id));
    assert.equal(group.accounts.length, 2);
    const mergeRequest = data => request("/api/admin/members/merge", { method: "POST", headers: { "content-type": "application/json", origin: baseUrl, cookie: websiteAdminCookie }, body: JSON.stringify(data) });
    const preview = (await (await mergeRequest({ action: "preview", groupId: group.id })).json()).preview;
    const merged = await mergeRequest({ action: "merge", groupId: group.id, fingerprint: preview.fingerprint, representativeMemberId: a.id, profile: preview.recommendedProfile });
    assert.equal(merged.status, 201);
    const mergeId = (await merged.json()).mergeId;
    const duplicate = await withdrawalFixture(client, "withdraw-unmerged", "가상미병합회원", "010-8811-2211");
    const duplicateBefore = (await client.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [duplicate.id] })).rows;
    await client.execute({ sql: "INSERT INTO member_merge_groups (id, representative_member_id, status, resolved_profile_json, created_by) VALUES ('withdraw-old-reverted', ?, 'reverted', ?, 'test-admin')", args: [a.id, JSON.stringify({ name: a.name, phone: a.phone })] });
    await client.execute({ sql: "INSERT INTO member_merge_accounts (merge_id, member_id, original_member_json) VALUES ('withdraw-old-reverted', ?, ?)", args: [duplicate.id, JSON.stringify({ name: duplicate.name })] });
    await client.execute({ sql: "INSERT INTO member_password_reset_requests (member_id) VALUES (?)", args: [b.id] });
    await client.execute({ sql: "INSERT INTO member_app_access (member_id, app_code, access_level) VALUES (?, 'worship_archive', 'full')", args: [b.id] });
    const login = await loginMember(b.username, b.password, "198.51.100.224");
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal((await withdrawal(cookie, duplicate.password, "198.51.100.225")).status, 401);
    const requests = await Promise.all([withdrawal(cookie, b.password, "198.51.100.226"), withdrawal(cookie, b.password, "198.51.100.227")]);
    assert.equal(requests.filter(response => response.status === 200).length, 1);
    // SQLite can refuse the second write lock instead of queuing it. No write
    // is automatically retried: the loser returns a safe retryable error.
    assert.ok(requests.every(response => [200, 401, 503].includes(response.status)));
    for (const response of requests.filter(response => response.status === 503)) assert.deepEqual(await response.json(), { error: "탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    for (const [table, columns] of [["members", ["id"]], ["member_login_aliases", ["source_member_id", "representative_member_id"]], ["member_auth_state", ["member_id"]], ["member_merge_accounts", ["member_id"]], ["member_app_access", ["member_id"]], ["member_password_reset_requests", ["member_id"]]]) {
      for (const column of columns) assert.equal(Number((await client.execute({ sql: `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} IN (?, ?)`, args: [a.id, b.id] })).rows[0].n), 0);
    }
    assert.equal(Number((await client.execute({ sql: "SELECT COUNT(*) AS n FROM member_merge_groups WHERE id = ?", args: [mergeId] })).rows[0].n), 0);
    const oldGroup = (await client.execute("SELECT * FROM member_merge_groups WHERE id = 'withdraw-old-reverted'")).rows[0];
    assert.equal(oldGroup.resolved_profile_json, "{}");
    assert.match(String(oldGroup.representative_member_id), /^withdrawn:/);
    assert.deepEqual((await client.execute({ sql: "SELECT * FROM members WHERE id = ?", args: [duplicate.id] })).rows, duplicateBefore);
    for (const oldCookie of [a.cookie, b.cookie, cookie]) assert.equal((await request("/api/session", { headers: { cookie: oldCookie } }).then(r => r.json())).authenticated, false);
    for (const [name, password] of [[a.username, a.password], [b.username, b.password], [a.name, a.password], [b.name, b.password]]) assert.equal((await loginMember(name, password, "198.51.100.228")).status, 401);
    assert.equal((await loginMember(duplicate.username, duplicate.password, "198.51.100.229")).status, 200);
    assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);
  } finally { client.close(); }
});
