import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

const outputArg = process.argv.find((value) => value.startsWith("--output="))?.slice(9);
if (!outputArg) throw new Error("명시적인 --output=<폴더>가 필요합니다.");
const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) throw new Error("Turso 백업용 환경변수가 없습니다.");

const output = path.resolve(outputArg);
await mkdir(output, { recursive: true });
const client = createClient({ url, authToken });
const encodeValue = (value) => value instanceof Uint8Array
  ? { $blob: Buffer.from(value).toString("base64") }
  : value;

try {
  const schema = await client.execute("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name");
  const tables = schema.rows.filter((row) => row.type === "table").map((row) => String(row.name));
  const data = {};
  for (const table of tables) {
    const escaped = table.replaceAll('"', '""');
    const result = await client.execute(`SELECT * FROM "${escaped}"`);
    data[table] = result.rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, encodeValue(value)]),
    ));
  }
  const payload = JSON.stringify({ format: "mhji-turso-logical-v1", createdAt: new Date().toISOString(), schema: schema.rows, data }, null, 2);
  const filename = `turso-${new Date().toISOString().replaceAll(":", "-")}.backup.json`;
  const backupPath = path.join(output, filename);
  await writeFile(backupPath, payload, { encoding: "utf8", flag: "wx" });
  const checksum = createHash("sha256").update(await readFile(backupPath)).digest("hex");
  await writeFile(`${backupPath}.sha256`, `${checksum}  ${filename}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`Turso logical backup verified: ${filename} (${tables.length} tables)`);
} finally {
  client.close();
}
