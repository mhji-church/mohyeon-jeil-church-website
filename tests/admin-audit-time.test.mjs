import assert from "node:assert/strict";
import test from "node:test";
import { formatAdminAuditTime } from "../lib/admin-audit-time.ts";

test("activity times show SQLite UTC timestamps in Korean time", () => {
  assert.equal(formatAdminAuditTime("2026-10-07 00:15:00"), "2026.10.07 09:15:00 KST");
  assert.equal(formatAdminAuditTime("2026-10-06T15:15:00Z"), "2026.10.07 00:15:00 KST");
  assert.equal(formatAdminAuditTime("2026-10-07T09:15:00+09:00"), "2026.10.07 09:15:00 KST");
  assert.equal(formatAdminAuditTime("invalid"), "invalid");
});
