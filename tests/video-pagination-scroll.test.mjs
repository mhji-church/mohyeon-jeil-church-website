import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../app/components/VideoArchivePage.tsx", import.meta.url),
  "utf8",
);

test("anchors paginated video archives to the section on every screen height", () => {
  assert.match(
    source,
    /const sectionTop = archiveSection\.getBoundingClientRect\(\)\.top \+ window\.scrollY;/,
  );
  assert.match(source, /const contentRevealOffset = mobile \? 42 : 76;/);
  assert.match(
    source,
    /const targetTop = sectionTop - headerOffset \+ contentRevealOffset;/,
  );
  assert.doesNotMatch(source, /paginationBottom/);
  assert.doesNotMatch(source, /window\.innerHeight/);
  assert.doesNotMatch(source, /archivePaginationRef/);
});
