import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const input = process.argv.find((value) => value.startsWith("--input="))?.slice(8);
const bucket = process.argv.find((value) => value.startsWith("--temporary-bucket="))?.slice(19);
if (!input || !bucket || !process.argv.includes("--confirm-temporary-target")) throw new Error("--input, --temporary-bucket, --confirm-temporary-target가 모두 필요합니다.");
if (!/(temp|restore|test)/i.test(bucket)) throw new Error("대상 버킷 이름에는 temp/restore/test가 포함되어야 합니다.");
if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_ENDPOINT) throw new Error("임시 복구용 R2 환경변수가 없습니다.");

const inputPath = path.resolve(input);
const manifest = JSON.parse(await readFile(path.join(inputPath, "manifest.backup.json"), "utf8"));
if (manifest.format !== "mhji-r2-backup-v1" || !Array.isArray(manifest.files)) {
  throw new Error("지원하지 않는 R2 백업 형식입니다.");
}
for (const file of manifest.files) {
  const fullPath = path.resolve(inputPath, String(file.key));
  if (!fullPath.startsWith(`${inputPath}${path.sep}`)) throw new Error("백업 경로가 올바르지 않습니다.");
  const info = await stat(fullPath);
  const sha256 = createHash("sha256").update(await readFile(fullPath)).digest("hex");
  if (info.size !== file.size || sha256 !== file.sha256) {
    throw new Error("R2 백업 파일 체크섬이 일치하지 않습니다.");
  }
}

const awsEnvironment = {
  ...process.env,
  AWS_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  AWS_DEFAULT_REGION: "auto",
};
const existing = spawnSync("aws", ["s3api", "list-objects-v2", "--bucket", bucket, "--max-items", "1", "--endpoint-url", process.env.R2_ENDPOINT, "--output", "json"], {
  encoding: "utf8",
  env: awsEnvironment,
});
if (existing.error || existing.status !== 0) throw new Error("임시 R2 버킷을 확인하지 못했습니다.");
if (Number(JSON.parse(existing.stdout || "{}").KeyCount || 0) > 0) {
  throw new Error("임시 복구 버킷이 비어 있지 않아 중단했습니다.");
}

const result = spawnSync("aws", ["s3", "sync", inputPath, `s3://${bucket}`, "--endpoint-url", process.env.R2_ENDPOINT, "--exclude", "manifest.backup.json", "--only-show-errors"], {
  stdio: "inherit",
  env: awsEnvironment,
});
if (result.error || result.status !== 0) throw new Error("임시 R2 복구가 실패했습니다.");
const restored = spawnSync("aws", ["s3api", "list-objects-v2", "--bucket", bucket, "--endpoint-url", process.env.R2_ENDPOINT, "--output", "json"], {
  encoding: "utf8",
  env: awsEnvironment,
});
if (restored.error || restored.status !== 0) throw new Error("임시 R2 복구 결과를 확인하지 못했습니다.");
const restoredObjects = new Map((JSON.parse(restored.stdout || "{}").Contents || []).map((item) => [item.Key, item.Size]));
if (manifest.files.some((file) => restoredObjects.get(file.key) !== file.size)) {
  throw new Error("임시 R2 복구 후 객체 크기 검증이 실패했습니다.");
}
console.log(`Temporary R2 restore verified: ${manifest.files.length} objects`);
