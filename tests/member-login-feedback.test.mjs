import assert from "node:assert/strict";
import test from "node:test";
import { loginRetryDeadline, loginSecondsRemaining, loginWaitClock, loginWaitMessage } from "../lib/member-login-feedback.ts";

test("Retry-After determines the deadline without replacing legacy durations with five minutes", () => {
  const now = Date.parse("2026-11-03T03:00:00Z");
  assert.equal(loginRetryDeadline("299", now), now + 299_000);
  assert.equal(loginRetryDeadline("900", now), now + 900_000);
  assert.equal(loginRetryDeadline("Tue, 03 Nov 2026 03:05:00 GMT", now), now + 300_000);
  for (const value of [null, "", "0", "-1", "invalid", "99999999999999999999", "Mon, 02 Nov 2026 03:05:00 GMT"]) {
    assert.equal(loginRetryDeadline(value, now), null);
  }
});

test("remaining time follows the deadline across suspended timers and expires without becoming negative", () => {
  const start = Date.parse("2026-11-03T03:00:00Z");
  const deadline = loginRetryDeadline("300", start);
  assert.equal(loginSecondsRemaining(deadline, start), 300);
  assert.equal(loginSecondsRemaining(deadline, start + 1), 300);
  assert.equal(loginSecondsRemaining(deadline, start + 1000), 299);
  assert.equal(loginSecondsRemaining(deadline, start + 241_100), 59);
  assert.equal(loginSecondsRemaining(deadline, deadline), 0);
  assert.equal(loginSecondsRemaining(deadline, deadline + 60_000), 0);
  assert.equal(loginWaitClock(299), "04:59");
  assert.equal(loginWaitClock(9), "00:09");
  assert.equal(loginWaitClock(900), "15:00");
  assert.equal(loginWaitMessage(299), "로그인 시도가 많아 일시적으로 제한되었습니다. 4분 59초 후 다시 시도해 주세요.");
});
