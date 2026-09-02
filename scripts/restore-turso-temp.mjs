import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const input = process.argv.find((value) => value.startsWith("--input="))?.slice(8);
const target = process.argv.find((value) => value.startsWith("--target="))?.slice(9);
if (!input || !target || !process.argv.includes("--confirm-temporary-target")) {
  throw new Error("--input, --target, --confirm-temporary-target가 모두 필요합니다.");
}
const targetPath = path.resolve(target);
if (!/mhji[-_].*(temp|restore)|[\\/](temp|tmp)[\\/]/i.test(targetPath)) {
  throw new Error("복구 대상은 이름에 temp/restore가 포함된 명시적 임시 경로여야 합니다.");
}
const inputPath = path.resolve(input);
const backupBytes = await readFile(inputPath);
const expectedChecksum = (await readFile(`${inputPath}.sha256`, "utf8")).trim().split(/\s+/)[0];
const actualChecksum = createHash("sha256").update(backupBytes).digest("hex");
if (!expectedChecksum || actualChecksum !== expectedChecksum) {
  throw new Error("백업 파일 체크섬이 일치하지 않습니다.");
}
const backup = JSON.parse(backupBytes.toString("utf8"));
if (backup.format !== "mhji-turso-logical-v1") throw new Error("지원하지 않는 백업 형식입니다.");
await mkdir(path.dirname(targetPath), { recursive: true });
const client = createClient({ url: pathToFileURL(targetPath).href });
const decodeValue = (value) => value && typeof value === "object" && "$blob" in value
  ? Buffer.from(value.$blob, "base64")
  : value;
try {
  for (const entry of backup.schema.filter((row) => row.type === "table")) await client.execute(String(entry.sql));
  for (const [table, rows] of Object.entries(backup.data)) {
    for (const row of rows) {
      const columns = Object.keys(row);
      const escapedTable = table.replaceAll('"', '""');
      const escapedColumns = columns.map((column) => `"${column.replaceAll('"', '""')}"`).join(", ");
      await client.execute({
        sql: `INSERT INTO "${escapedTable}" (${escapedColumns}) VALUES (${columns.map(() => "?").join(", ")})`,
        args: columns.map((column) => decodeValue(row[column])),
      });
    }
  }
  for (const entry of backup.schema.filter((row) => row.type !== "table")) await client.execute(String(entry.sql));
  const check = await client.execute("PRAGMA integrity_check");
  if (String(check.rows[0]?.integrity_check) !== "ok") throw new Error("임시 복구 DB 무결성 검사가 실패했습니다.");
  console.log(`Temporary restore verified: ${targetPath}`);
} finally {
  client.close();
}
