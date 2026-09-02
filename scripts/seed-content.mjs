import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";

const input = process.argv.find((value) => value.startsWith("--input="))?.slice(8);
if (!input || process.env.ALLOW_CONTENT_SEED !== "yes") {
  throw new Error("명시적인 --input과 ALLOW_CONTENT_SEED=yes가 필요합니다.");
}
const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url) throw new Error("TURSO_DATABASE_URL이 없습니다.");
const client = createClient({ url, authToken });
try {
  const count = await client.execute("SELECT COUNT(*) AS count FROM content_posts");
  if (Number(count.rows[0]?.count ?? 0) !== 0) throw new Error("비어 있지 않은 content_posts에는 seed를 실행하지 않습니다.");
  const posts = JSON.parse(await readFile(input, "utf8"));
  if (!Array.isArray(posts)) throw new Error("seed 파일은 게시물 배열이어야 합니다.");
  await client.batch(posts.map((post) => ({ sql: "INSERT INTO content_posts (id, type, title, date, excerpt, category, content, images, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [post.id, post.type, post.title, post.date, post.excerpt ?? "", post.category ?? "", post.content ?? "", JSON.stringify(post.images ?? []), post.status ?? "draft", Number(post.sortOrder ?? 0)] })), "write");
  console.log(`Explicit seed completed: ${posts.length} rows`);
} finally {
  client.close();
}
