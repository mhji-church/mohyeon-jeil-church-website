import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const outputArg = process.argv.find((value) => value.startsWith("--output="))?.slice(9);
if (!outputArg) throw new Error("명시적인 --output=<폴더>가 필요합니다.");
const required = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET_NAME"];
if (required.some((name) => !process.env[name]?.trim())) throw new Error("R2 백업용 환경변수가 없습니다.");
const output = path.resolve(outputArg);
await mkdir(output, { recursive: true });
if ((await readdir(output)).length > 0) {
  throw new Error("R2 백업 출력 폴더는 비어 있어야 합니다.");
}
const result = spawnSync("aws", ["s3", "sync", `s3://${process.env.R2_BUCKET_NAME}`, output, "--endpoint-url", process.env.R2_ENDPOINT, "--only-show-errors"], {
  stdio: "inherit",
  env: { ...process.env, AWS_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION: "auto" },
});
if (result.error) throw new Error("AWS CLI를 실행할 수 없습니다. 설치 여부를 확인하세요.");
if (result.status !== 0) throw new Error("R2 백업 다운로드가 실패했습니다.");
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name !== "manifest.backup.json") {
      const info = await stat(full);
      files.push({ key: path.relative(output, full).replaceAll("\\", "/"), size: info.size, sha256: createHash("sha256").update(await readFile(full)).digest("hex") });
    }
  }
}
await walk(output);
await writeFile(path.join(output, "manifest.backup.json"), JSON.stringify({ format: "mhji-r2-backup-v1", createdAt: new Date().toISOString(), files }, null, 2), { flag: "wx" });
console.log(`R2 backup verified: ${files.length} objects`);
