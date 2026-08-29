import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable. Run this script through npm test.");
run(process.execPath, [npmCli, "run", "typecheck"]);
run(process.execPath, [npmCli, "run", "build"], { ...process.env, NITRO_PRESET: "netlify" });

const testFiles = readdirSync(new URL("../tests/", import.meta.url))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => fileURLToPath(new URL(`../tests/${name}`, import.meta.url)));
// Several suites start their own Vite preview against temporary databases.
// Run files serially so those dev servers do not compete for shared Vite caches.
run(process.execPath, ["--test", "--test-concurrency=1", ...testFiles]);
