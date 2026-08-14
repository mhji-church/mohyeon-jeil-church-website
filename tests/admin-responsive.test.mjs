import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("uses one responsive admin layout for every content section", () => {
  const dashboard = readSource("../app/admin/AdminDashboard.tsx");
  const members = readSource("../app/admin/members/AdminMembers.tsx");
  const styles = readSource("../app/globals.css");

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
});
