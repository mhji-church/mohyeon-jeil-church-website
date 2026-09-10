import assert from "node:assert/strict";
import test from "node:test";
import {
  findMemberDuplicateCheck,
  normalizeDuplicateBirthDate,
  normalizeDuplicatePhone,
} from "../lib/member-duplicates.ts";

function member(id, overrides = {}) {
  return {
    id,
    username: `member-${id}`,
    name: `가상 회원 ${id}`,
    phone: `010-9000-${String(id).padStart(4, "0")}`,
    birthDate: `1980-01-${String(Number(id) || 1).padStart(2, "0")}`,
    status: "approved",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

test("duplicate comparison normalizes Korean mobile numbers and valid birth dates", () => {
  assert.equal(normalizeDuplicatePhone("010-1234-5678"), "01012345678");
  assert.equal(normalizeDuplicatePhone("010 1234 5678"), "01012345678");
  assert.equal(normalizeDuplicatePhone("+82 10 1234 5678"), "01012345678");
  assert.equal(normalizeDuplicatePhone("0082 10 1234 5678"), "01012345678");
  assert.equal(normalizeDuplicatePhone(""), null);
  assert.equal(normalizeDuplicatePhone("02-123-4567"), null);
  assert.equal(normalizeDuplicateBirthDate("2000-02-29"), "2000-02-29");
  assert.equal(normalizeDuplicateBirthDate("2001-02-29"), null);
  assert.equal(normalizeDuplicateBirthDate("잘못된 날짜"), null);
  assert.equal(normalizeDuplicateBirthDate(""), null);
});

test("duplicate comparison reports phone, birth date, and both fields per matching member", () => {
  const target = member("1", { phone: "+82 10 1234 5678", birthDate: "1985-05-05", status: "pending" });
  const phone = member("2", { phone: "010-1234-5678", birthDate: "1980-02-02" });
  const birth = member("3", { phone: "010-3333-3333", birthDate: "1985-05-05", status: "pending" });
  const both = member("4", { phone: "010 1234 5678", birthDate: "1985-05-05", status: "suspended" });
  const check = findMemberDuplicateCheck(target, [target, phone, birth, both]);
  assert.deepEqual(check?.matches.map((match) => [match.id, match.matchedFields]), [
    ["2", ["phone"]],
    ["3", ["birthDate"]],
    ["4", ["phone", "birthDate"]],
  ]);
  assert.deepEqual(check?.matchedFields, ["phone", "birthDate"]);
});

test("duplicate comparison excludes self, absent deleted records, and unusable values", () => {
  const target = member("1", { phone: "", birthDate: "2024-02-30" });
  assert.equal(findMemberDuplicateCheck(target, [target]), null);

  const unique = member("2", { phone: "010-7777-7777", birthDate: "1977-07-07" });
  const deletedButAbsent = member("deleted", { phone: unique.phone, birthDate: unique.birthDate });
  assert.equal(findMemberDuplicateCheck(unique, [unique]), null);
  assert.ok(findMemberDuplicateCheck(unique, [unique, deletedButAbsent]));
});

test("duplicate flags recalculate when member information changes", () => {
  const existing = member("1", { phone: "010-1111-2222", birthDate: "1990-03-04" });
  const pending = member("2", { phone: "010-9999-8888", birthDate: "1992-06-07", status: "pending" });
  assert.equal(findMemberDuplicateCheck(pending, [existing, pending]), null);

  const changed = { ...pending, phone: "+82 10 1111 2222" };
  assert.deepEqual(findMemberDuplicateCheck(changed, [existing, changed])?.matchedFields, ["phone"]);

  const restored = { ...changed, phone: "010-9999-8888" };
  assert.equal(findMemberDuplicateCheck(restored, [existing, restored]), null);
});
