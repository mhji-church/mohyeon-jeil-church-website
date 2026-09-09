import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getMemberDisplayPosition } from "../lib/member-display.ts";

test("member profile display keeps only the position before the first slash", () => {
  assert.equal(getMemberDisplayPosition("집사 / 미디어팀"), "집사");
  assert.equal(getMemberDisplayPosition("집사/새가족팀"), "집사");
  assert.equal(getMemberDisplayPosition("  권사  "), "권사");
  assert.equal(getMemberDisplayPosition("집사///찬양팀"), "집사");
  assert.equal(getMemberDisplayPosition(" / 미디어팀"), "");
  assert.equal(getMemberDisplayPosition("   "), "");
  assert.equal(getMemberDisplayPosition(null), "");
});

test("display-only formatting does not alter member administration values", async () => {
  const [sessionRoute, archiveAccess, memberAdmin, memberProfile, signup] = await Promise.all([
    readFile("app/api/session/route.ts", "utf8"),
    readFile("lib/archive-access.ts", "utf8"),
    readFile("app/admin/members/AdminMembers.tsx", "utf8"),
    readFile("app/member/MemberProfileForm.tsx", "utf8"),
    readFile("app/member/signup/SignupForm.tsx", "utf8"),
  ]);

  assert.match(sessionRoute, /getMemberDisplayPosition\(member\.position\)/);
  assert.match(archiveAccess, /getMemberDisplayPosition\(member\.position\)/);
  assert.match(memberAdmin, /\{member\.position \|\| "-"\}/);
  assert.match(memberProfile, /defaultValue=\{member\.position\}/);
  assert.match(signup, /signup-position-help/);
  assert.match(signup, /집사 \/ 미디어팀/);
});
