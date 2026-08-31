import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("member signup uses one accessible short form without a separate username", async () => {
  const [form, page, styles] = await Promise.all([
    readFile("app/member/signup/SignupForm.tsx", "utf8"),
    readFile("app/member/signup/page.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);

  assert.doesNotMatch(form, /name="username"|아이디 중복 확인/);
  assert.match(form, /name="name"/);
  assert.match(form, /name="phone"/);
  assert.match(form, /inputMode="numeric"/);
  assert.match(form, /name="birthYear"/);
  assert.match(form, /name="birthMonth"/);
  assert.match(form, /name="birthDay"/);
  assert.doesNotMatch(form, /type="date"/);
  assert.doesNotMatch(form, /달력에서 연도를 찾을 필요 없이/);
  assert.match(form, /<b>출생연도<\/b><em>4자리<\/em>/);
  assert.match(form, /예: 1955년 3월 12일/);
  assert.match(form, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(form, /aria-live="assertive"/);
  assert.match(form, /data-dialog-autofocus/);
  assert.match(form, /회원가입이 완료됐습니다/);
  assert.doesNotMatch(form, /지금 바로 로그인할 수 있습니다/);
  assert.doesNotMatch(form, /예배 아카이브/);
  assert.match(form, /갤러리 등 회원 전용 콘텐츠는 관리자 승인 후 볼 수 있습니다/);
  assert.doesNotMatch(form, /화면을 캡처하거나 종이에 적어두세요/);
  assert.doesNotMatch(page, /천천히 입력해 주세요/);
  assert.doesNotMatch(form, /천천히/);
  assert.match(form, /localStorage\.setItem\(SIGNUP_COMPLETE_KEY, "1"\)/);
  assert.doesNotMatch(form, /localStorage\.setItem\([^\n]*(password|phone|birth|name)/i);
  assert.match(page, /별도의 아이디를 만들지 않고 이름으로 신청할 수 있습니다/);
  assert.match(styles, /\.member-form input:not\(\[type="checkbox"\]\)[\s\S]*min-height: 54px/);
  assert.match(styles, /\.member-form > button[\s\S]*min-height: 56px/);
  assert.match(styles, /\.gallery-approval-dialog h2 \{[^}]*margin: 10px 42px 8px;[^}]*text-align: center;/);
  assert.match(styles, /\.gallery-approval-dialog > p \{[^}]*margin: 0 auto 24px/);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*?\.gallery-approval-dialog h2 \{[^}]*white-space: nowrap;[^}]*font-size: clamp\(16px, 4\.8vw, 19px\);/);
});

test("pending members can sign in while protected content still requires approval", async () => {
  const [sessionRoute, memberAuth, archiveAccess, playback, galleryPage, galleryMedia, media, galleryBoard] = await Promise.all([
    readFile("app/api/members/session/route.ts", "utf8"),
    readFile("app/member-auth.ts", "utf8"),
    readFile("app/api/archive/access/route.ts", "utf8"),
    readFile("app/api/archive/videos/[id]/playback/route.ts", "utf8"),
    readFile("app/gallery/page.tsx", "utf8"),
    readFile("app/api/gallery/media/route.ts", "utf8"),
    readFile("app/api/media/route.ts", "utf8"),
    readFile("app/gallery/GalleryBoard.tsx", "utf8"),
  ]);

  assert.match(sessionRoute, /approvalPending: result\.member\.status === "pending"/);
  assert.doesNotMatch(memberAuth, /member\.status !== "approved"/);
  assert.match(memberAuth, /member\.status === "suspended"/);
  assert.match(archiveAccess, /approvalPending: true/);
  assert.match(archiveAccess, /songStatsAllowed: false/);
  assert.match(playback, /member\.status !== "approved"/);
  assert.match(galleryPage, /member\?\.status === "approved"/);
  assert.match(galleryMedia, /member\?\.status !== "approved"/);
  assert.match(media, /member\?\.status !== "approved"/);
  assert.match(galleryBoard, /관리자 승인 후 볼 수 있습니다/);
});

test("birth date validation keeps the existing API and database format", async () => {
  const [helper, form, route, members] = await Promise.all([
    readFile("lib/member-signup.ts", "utf8"),
    readFile("app/member/signup/SignupForm.tsx", "utf8"),
    readFile("app/api/members/signup/route.ts", "utf8"),
    readFile("lib/members.ts", "utf8"),
  ]);

  assert.match(helper, /Date\.UTC\(year, month - 1, day\)/);
  assert.match(helper, /EARLIEST_BIRTH_YEAR = 1900/);
  assert.match(helper, /미래 날짜는 생년월일로 입력할 수 없습니다/);
  assert.ok(form.includes('`${date.year}-${date.month}-${date.day}`'));
  assert.match(form, /digits\.length !== 8/);
  assert.ok(route.includes("birthDate:"));
  assert.ok(route.includes("payload.birthDate"));
  assert.match(members, /birth_date/);
  assert.match(members, /memberLoginCandidate/);
  assert.match(members, /isUsernameConflict/);
});

test("signup and login dialogs support keyboard and screen reader users", async () => {
  const [dialog, signup, login] = await Promise.all([
    readFile("app/components/AccessibleDialog.tsx", "utf8"),
    readFile("app/member/signup/SignupForm.tsx", "utf8"),
    readFile("app/member/login/MemberLoginForm.tsx", "utf8"),
  ]);

  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /const FOCUSABLE/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
  assert.match(dialog, /openerRef\.current\?\.focus\(\)/);
  assert.match(signup, /가입 방법 보기/);
  assert.match(login, /showPassword \? "숨기기" : "보기"/);
});

test("mobile homepage prioritizes the unauthenticated signup notice over the PWA prompt", async () => {
  const [home, layout, chrome, styles] = await Promise.all([
    readFile("app/page.tsx", "utf8"),
    readFile("app/layout.tsx", "utf8"),
    readFile("app/components/SiteLayoutChrome.tsx", "utf8"),
    readFile("app/globals.css", "utf8"),
  ]);

  assert.match(home, /교인 회원가입 안내/);
  assert.match(home, /회원가입 신청하기/);
  assert.match(home, /가입 방법 보기/);
  assert.match(home, /가입하셨나요\?/);
  assert.match(home, /<strong>로그인<\/strong>/);
  assert.match(home, /오늘 그만 보기/);
  assert.match(home, /matchMedia\("\(max-width: 720px\)"\)/);
  assert.match(home, /if \(authenticated/);
  assert.match(home, /setInstallPanelOpen\(false\)/);
  assert.match(home, /signupNoticeChecked/);
  assert.match(home, /!signupOpen &&/);
  assert.match(home, /mhji-signup-notice-hide-date/);
  assert.match(home, /mhji-member-signup-completed/);
  assert.doesNotMatch(home, /localStorage\.setItem\([^\n]*(password|phone|birth|name)/i);
  assert.match(layout, /getAdminSession/);
  assert.match(layout, /initiallyAuthenticated=\{Boolean\(member \|\| admin\)\}/);
  assert.match(chrome, /useSiteAuthentication/);
  assert.match(styles, /\.home-signup-sheet[\s\S]*font-size: 16px/);
  assert.match(styles, /\.home-signup-actions a[\s\S]*min-height: 52px/);
  assert.match(styles, /@media \(max-width: 340px\)/);
});

test("member login throttling is persistent and stores only a hashed rate key", async () => {
  const [route, members, schema, migration] = await Promise.all([
    readFile("app/api/members/session/route.ts", "utf8"),
    readFile("lib/members.ts", "utf8"),
    readFile("db/schema.ts", "utf8"),
    readFile("drizzle/0008_member_login_attempts.sql", "utf8"),
  ]);

  assert.match(route, /x-nf-client-connection-ip/);
  assert.match(route, /x-forwarded-for/);
  assert.match(route, /status: 429/);
  assert.match(route, /retry-after/);
  assert.match(members, /crypto\.subtle\.digest\([\s\S]*"SHA-256"/);
  assert.match(members, /LOGIN_FAILURE_LIMIT = 5/);
  assert.match(members, /INSERT INTO member_login_attempts/);
  assert.match(schema, /member_login_attempts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `member_login_attempts`/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS `member_login_attempts_updated_idx`/);
});
