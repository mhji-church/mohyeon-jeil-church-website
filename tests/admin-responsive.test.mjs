import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("uses one responsive admin layout for every content section", () => {
  const dashboard = readSource("../app/admin/AdminDashboard.tsx");
  const members = readSource("../app/admin/members/AdminMembers.tsx");
  const archive = readSource("../app/admin/archive/ArchiveAdmin.tsx");
  const styles = readSource("../app/globals.css");
  const archiveStyles = readSource("../app/archive/archive-original.css");

  for (const source of [dashboard, members]) {
    assert.match(source, /admin-shell admin-members-shell/);
    assert.match(source, /admin-workspace admin-members-workspace/);
    assert.match(source, /admin-stats admin-member-stats/);
  }

  assert.match(dashboard, /className="admin-content-table"/);
  assert.match(styles, /\.admin-content-table\s*\{/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.admin-content-table thead/);
  assert.match(styles, /\/\* Mobile administrator usability \*\//);
  assert.match(styles, /\.admin-members-shell \.admin-account\s*\{[\s\S]*display: grid/);
  assert.match(styles, /\.admin-login-form input\s*\{[\s\S]*font-size: 16px/);
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
});

test("archive admin list API forwards management filters", () => {
  const route = readSource("../app/api/admin/archive/videos/route.ts");

  assert.match(route, /serviceGroup:/);
  assert.match(route, /search: params\.get\("search"\)/);
  assert.match(route, /sort: params\.get\("sort"\) === "oldest"/);
});
