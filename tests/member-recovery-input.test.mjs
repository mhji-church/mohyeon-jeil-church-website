import assert from "node:assert/strict";
import test from "node:test";
import { birthDateRecoveryHint } from "../lib/member-recovery-input.ts";

test("recovery birth hints validate stored full dates and preserve zeroes without guessing centuries", () => {
  assert.equal(birthDateRecoveryHint("1982-11-08"), "821108");
  assert.equal(birthDateRecoveryHint("2000-01-02"), "000102");
  assert.equal(birthDateRecoveryHint("1920-02-03"), "200203");
  assert.equal(birthDateRecoveryHint("2020-02-03"), "200203");
  assert.equal(birthDateRecoveryHint("2000-02-29"), "000229");
  for (const value of ["", "000102", "1900-02-29", "2020-04-31", "1982-1-08", "2999-01-01", "invalid"]) assert.equal(birthDateRecoveryHint(value), null);
});
