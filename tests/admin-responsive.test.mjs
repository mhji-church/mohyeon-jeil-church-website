import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("uses one responsive admin layout for every content section", () => {
  const dashboard = readSource("../app/admin/AdminDashboard.tsx");
  const members = readSource("../app/admin/members/AdminMembers.tsx");
  const home = readSource("../app/admin/page.tsx");
  const sidebar = readSource("../app/admin/AdminSidebar.tsx");
  const pagination = readSource("../app/admin/AdminPagination.tsx");
  const content = readSource("../lib/content.ts");
  const membersSource = readSource("../lib/members.ts");
  const database = readSource("../lib/netlify-db.ts");
  const postsRoute = readSource("../app/api/admin/posts/route.ts");
  const archive = readSource("../app/admin/archive/ArchiveAdmin.tsx");
  const styles = readSource("../app/globals.css");
  const archiveStyles = readSource("../app/archive/archive-original.css");

  for (const source of [dashboard, members]) {
    assert.match(source, /admin-shell admin-members-shell/);
    assert.match(source, /admin-workspace admin-members-workspace/);
    assert.doesNotMatch(source, /admin-stats admin-member-stats/);
    assert.match(source, /<AdminPagination/);
  }

  assert.match(home, /승인 대기 회원/);
  assert.match(home, /이번 달 게시 콘텐츠/);
  assert.match(home, /전체 승인 회원/);
  assert.match(home, /RECENT CONTENT/);
  assert.match(home, /최근 콘텐츠/);
  assert.match(home, /빠른 등록/);
  assert.doesNotMatch(home, /ADMIN OVERVIEW/);
  assert.doesNotMatch(home, /교회 홈페이지 운영 현황과 최근 변경 내용을 한눈에 확인합니다/);
  assert.match(home, /className="admin-home-detail-grid"/);
  assert.match(home, /게시 \{publishDate\.formatted\}/);
  assert.match(home, /getKoreaDate\(parsed\)/);
  assert.match(home, /getKoreaDate\(\)\.slice\(0, 7\)\.replaceAll\("\.", "-"\)/);
  assert.match(home, /게시일 기준/);
  assert.match(home, /게시 콘텐츠 관리하기/);
  assert.doesNotMatch(home, /최근 6건/);
  assert.doesNotMatch(home, /icon: "[BNGS]"/);
  assert.doesNotMatch(home, /홈페이지 보기/);
  assert.match(sidebar, /href="\/admin" aria-label="관리자 홈"/);
  assert.match(sidebar, /승인 \{pendingMemberCount\}/);
  assert.match(sidebar, /홈페이지로 돌아가기/);
  assert.match(sidebar, /rel="noopener noreferrer"/);
  assert.match(pagination, /totalPages <= 1/);
  assert.match(pagination, /aria-current=\{page === currentPage \? "page"/);
  assert.match(dashboard, /className="admin-content-table"/);
  assert.doesNotMatch(dashboard, /admin-member-alert/);
  assert.match(styles, /\.admin-pagination\s*\{/);
  assert.match(styles, /\.admin-home-status-grid\s*\{/);
  assert.match(styles, /\.admin-home-detail-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 2fr\) minmax\(300px, 1fr\)/);
  assert.match(styles, /font-family: "Pretendard Archive", "Pretendard Variable", Pretendard/);
  assert.match(styles, /\.admin-members-shell \.admin-table-wrap td\s*\{[\s\S]*font-size: 14px/);
  assert.match(styles, /\.admin-members-shell \.admin-row-actions button\s*\{[\s\S]*min-height: 40px[\s\S]*font-size: 13px/);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.admin-content-table thead/);
  assert.match(styles, /\.admin-content-table\s*\{/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.admin-content-table thead/);
  assert.match(styles, /\/\* Mobile administrator usability \*\//);
  assert.match(styles, /\.admin-members-shell \.admin-account\s*\{[\s\S]*display: grid/);
  assert.match(styles, /\.admin-login-form input\s*\{[\s\S]*font-size: 16px/);
  assert.match(content, /substr\(replace\(replace\(trim\(date\), '\.', '-'\), '\/', '-'\), 1, 7\) = \?/);
  assert.match(content, /WHEN trim\(coalesce\(date, ''\)\) <> ''[\s\S]*replace\(replace\(trim\(date\), '\.', '-'\), '\/', '-'\)[\s\S]*ELSE substr\(coalesce\(nullif\(created_at, ''\), ''\), 1, 10\)/);
  assert.match(content, /sort_order DESC,[\s\S]*coalesce\(nullif\(updated_at, ''\), created_at, ''\) DESC,[\s\S]*id DESC[\s\S]*LIMIT 6/);
  assert.doesNotMatch(content, /getAdminContentSummary[\s\S]*Promise\.all\(/);
  assert.match(membersSource, /getAdminMemberSummary/);
  assert.match(membersSource, /SUM\(CASE WHEN status = 'pending'/);
  assert.doesNotMatch(home, /Promise\.allSettled/);
  assert.match(home, /member summary read failed/);
  assert.match(home, /content summary read failed/);
  assert.match(database, /transientReadErrorCodes/);
  assert.match(database, /isReadStatement\(statement\.sql\)/);
  assert.match(database, /readRetryDelayMs = 150/);
  assert.match(database, /async run\(\)[\s\S]*this\.client\.execute/);
  assert.match(postsRoute, /content list read failed/);
  assert.match(postsRoute, /status: 503/);
  assert.match(dashboard, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
  assert.match(dashboard, /finally \{\s*setLoading\(false\)/);
  assert.match(archive, /<ArchiveShell admin/);
  assert.match(archive, /archive-admin-workspace/);
  assert.match(archive, /cms-page-head has-actions/);
  assert.match(archive, /mode === "new" \? <div className="archive-form-page"/);
  assert.match(archive, /className="archive-list-search"/);
  assert.match(archive, /className="archive-list-filters"/);
  assert.match(archive, /className="archive-edit-layer"/);
  assert.match(archive, /className="archive-advanced-fields"/);
  assert.match(archive, /href="\/archive\/admin\/new"/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-admin-workspace\s*\{[^}]*width: min\(100%, 1600px\)/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-admin-workspace\.is-new-video\s*\{[^}]*width: min\(100%, 1120px\)/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-edit-drawer\s*\{/);
  assert.match(archiveStyles, /@media \(max-width: 560px\)[\s\S]*\.archive-editor-grid/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-video-list td:nth-child\(6\)::before\s*\{\s*content: "관리"/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-access-list td:nth-child\(3\)::before\s*\{\s*content: "등급"/);
  assert.match(archiveStyles, /--on-accent: #2e2d33/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-admin-tabs button\.active\s*\{[^}]*background: var\(--accent\);[^}]*color: var\(--on-accent\)/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-youtube-field \.secondary-btn/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-admin-form-actions \.primary-btn/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-admin-pagination\s*\{[^}]*background: var\(--surface-soft\)/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-video-table \.admin-row-actions\s*\{[^}]*grid-template-columns: repeat\(2/);
  assert.match(archiveStyles, /\.archive-original-root \.archive-content-editor\s*\{/);
  assert.match(archive, /예배 내용/);
  assert.match(archive, /한 줄에 한 곡씩 입력해 주세요/);
  assert.doesNotMatch(archive, /무료 영상 분석|예배 영상 자동 분석|youtube-oauth/);
});

test("archive worship contents are saved from direct admin input without time offsets", () => {
  const archive = readSource("../app/admin/archive/ArchiveAdmin.tsx");
  const route = readSource("../app/api/admin/archive/videos/route.ts");
  const portal = readSource("../app/archive/ArchivePortal.tsx");
  const styles = readSource("../app/archive/archive-original.css");

  assert.match(archive, /songsText/);
  assert.match(archive, /sermonTitle/);
  assert.match(archive, /biblePassage/);
  assert.match(archive, /prayerName/);
  assert.match(route, /manual-entry-v1/);
  assert.match(route, /startSeconds: null/);
  assert.doesNotMatch(route, /queueArchiveVideoAnalysis|processNextArchiveAnalysisJob/);
  assert.match(portal, /viewer-song-number/);
  assert.match(portal, /sermonTitleStyle/);
  assert.match(portal, /viewer-sermon-title/);
  assert.ok(portal.includes("{index + 1}."));
  assert.match(portal, /<p>설교 · \{video\.preacher \|\| "모현제일교회"\}<\/p>/);
  assert.match(portal, /<h1>\{featured\.title\}<\/h1>/);
  assert.doesNotMatch(portal, /찬양 \$\{publicSongs|sermonSummary/);
  assert.match(styles, /\.viewer-song-number\s*\{/);
  assert.match(styles, /\.viewer-sermon-title\s*\{[^}]*white-space: nowrap/);
});

test("archive admin list API forwards management filters", () => {
  const route = readSource("../app/api/admin/archive/videos/route.ts");

  assert.match(route, /serviceGroup:/);
  assert.match(route, /search: params\.get\("search"\)/);
  assert.match(route, /sort: params\.get\("sort"\) === "oldest"/);
});
