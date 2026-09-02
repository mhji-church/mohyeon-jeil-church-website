import { deleteExternalObjects } from "./external-r2";
import { externalMediaKey, externalMediaUrl } from "./media-path";
import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";
import { adminAuditStatement, type AdminAuditInput } from "./admin-audit";
import {
  contentPageForRow,
  normalizeContentPage,
  PUBLIC_CONTENT_PAGE_SIZE,
} from "./public-pagination";

export type ContentType = "bulletin" | "news" | "gallery" | "business";
export type ContentStatus = "published" | "draft";

export type ContentPost = {
  id: string;
  type: ContentType;
  title: string;
  date: string;
  excerpt: string;
  category: string;
  content: string;
  images: string[];
  status: ContentStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GalleryListItem = Pick<
  ContentPost,
  "id" | "title" | "date" | "excerpt" | "category"
> & {
  coverImage: string;
  imageCount: number;
};

export type ContentPostInput = Omit<
  ContentPost,
  "id" | "createdAt" | "updatedAt"
>;

export type ContentPostPage = {
  posts: ContentPost[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  targetPage: number | null;
};

function getD1() {
  return getNetlifyDb();
}

export async function ensureContentStore() {
  await ensureNetlifySchema();
}

function publicMediaUrl(url: string) {
  if (url.startsWith("/api/media/object/")) return url;
  if (!url.startsWith("/api/media?")) return url;
  const params = new URLSearchParams(url.slice(url.indexOf("?")));
  const key = params.get("path") ?? params.get("key");
  if (!key) return url;
  return externalMediaUrl(key);
}

function mapRow(row: Record<string, unknown>): ContentPost {
  const images = JSON.parse(String(row.images ?? "[]")) as string[];
  return {
    id: String(row.id),
    type: row.type as ContentType,
    title: String(row.title),
    date: String(row.date),
    excerpt: String(row.excerpt ?? ""),
    category: String(row.category ?? ""),
    content: String(row.content ?? ""),
    images: images.map(publicMediaUrl),
    status: row.status as ContentStatus,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listContentPosts(options?: {
  type?: ContentType;
  includeDrafts?: boolean;
  limit?: number;
}): Promise<ContentPost[]> {
  await ensureContentStore();
  const db = getD1();
  const filters: string[] = [];
  const values: (string | number)[] = [];
  if (options?.type) {
    filters.push("type = ?");
    values.push(options.type);
  }
  if (!options?.includeDrafts) {
    filters.push("status = 'published'");
  }
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  const query = `SELECT * FROM content_posts
    ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
    ORDER BY date DESC, sort_order DESC, created_at DESC
    LIMIT ?`;
  const result = await db
    .prepare(query)
    .bind(...values, limit)
    .all<Record<string, unknown>>();
  return result.results.map(mapRow);
}

export async function listPublicContentPostPage(options: {
  type: "bulletin" | "news";
  page?: string;
  targetDate?: string | null;
  pageSize?: number;
}): Promise<ContentPostPage> {
  await ensureContentStore();
  const db = getD1();
  const pageSize = Math.min(Math.max(options.pageSize ?? PUBLIC_CONTENT_PAGE_SIZE, 1), 50);
  const countRow = await db
    .prepare("SELECT COUNT(*) AS count FROM content_posts WHERE type = ? AND status = 'published'")
    .bind(options.type)
    .first<{ count: number | string }>();
  const totalCount = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  let targetPage: number | null = null;
  if (options.targetDate) {
    const targetRow = await db
      .prepare(
        `WITH ordered AS (
          SELECT date, ROW_NUMBER() OVER (
            ORDER BY date DESC, sort_order DESC, created_at DESC, id DESC
          ) AS row_number
          FROM content_posts
          WHERE type = ? AND status = 'published'
        )
        SELECT row_number FROM ordered WHERE date = ? ORDER BY row_number LIMIT 1`,
      )
      .bind(options.type, options.targetDate)
      .first<{ row_number: number | string }>();
    if (targetRow) targetPage = contentPageForRow(Number(targetRow.row_number), pageSize);
  }

  const currentPage = targetPage ?? normalizeContentPage(options.page, totalPages);
  const result = await db
    .prepare(
      `SELECT * FROM content_posts
       WHERE type = ? AND status = 'published'
       ORDER BY date DESC, sort_order DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(options.type, pageSize, (currentPage - 1) * pageSize)
    .all<Record<string, unknown>>();

  return {
    posts: result.results.map(mapRow),
    totalCount,
    currentPage,
    totalPages,
    targetPage,
  };
}

export async function getAdminContentSummary(month: string) {
  await ensureContentStore();
  const db = getD1();
  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM content_posts
       WHERE substr(replace(replace(trim(date), '.', '-'), '/', '-'), 1, 7) = ?`,
    )
    .bind(month)
    .first<{ count: number | string }>();
  const recentResult = await db
    .prepare(
      `SELECT * FROM content_posts
       ORDER BY
         CASE
           WHEN trim(coalesce(date, '')) <> ''
             THEN replace(replace(trim(date), '.', '-'), '/', '-')
           ELSE substr(coalesce(nullif(created_at, ''), ''), 1, 10)
         END DESC,
         sort_order DESC,
         coalesce(nullif(updated_at, ''), created_at, '') DESC,
         id DESC
       LIMIT 6`,
    )
    .all<Record<string, unknown>>();
  return {
    monthlyCount: Number(countRow?.count ?? 0),
    recentPosts: recentResult.results.map(mapRow),
  };
}

export async function listPublicGalleryPosts(
  limit = 100,
): Promise<GalleryListItem[]> {
  const posts = await listContentPosts({ type: "gallery", limit });
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    date: post.date,
    excerpt: post.excerpt,
    category: post.category,
    coverImage: post.images[0] ?? "",
    imageCount: post.images.length,
  }));
}

export async function getContentPost(id: string): Promise<ContentPost | null> {
  await ensureContentStore();
  const row = await getD1()
    .prepare("SELECT * FROM content_posts WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  return row ? mapRow(row) : null;
}

export function uploadedObjectKey(url: string) {
  if (url.startsWith("/api/media/object/")) {
    const token = url.slice("/api/media/object/".length).split(/[?#]/, 1)[0];
    const key = externalMediaKey(token);
    return key && /^(gallery|bulletins|businesses|content\/[a-z-]+)\//.test(key)
      ? { store: "external" as const, key }
      : null;
  }
  if (!url.startsWith("/api/media?")) return null;
  const query = url.slice(url.indexOf("?"));
  const params = new URLSearchParams(query);
  const key = params.get("path") ?? params.get("key");
  if (!key) return null;
  if (
    params.get("store") === "external" &&
    /^(gallery|bulletins|businesses|content\/[a-z-]+)\//.test(key)
  ) {
    return { store: "external" as const, key };
  }
  return key.startsWith("uploads/")
    ? { store: "internal" as const, key }
    : null;
}

export async function getUploadedMediaAccess(
  key: string,
): Promise<"public" | "member" | "unreferenced"> {
  await ensureContentStore();
  // Read the small set of post image lists and compare decoded object keys in
  // application code. A SQL LIKE query against percent-encoded, non-ASCII
  // filenames can fail in D1 and make an otherwise valid R2 object unreadable.
  const result = await getD1()
    .prepare(
      `SELECT type, status, images
       FROM content_posts
       WHERE type IN ('bulletin', 'gallery', 'business')`,
    )
    .all<Record<string, unknown>>();

  let memberOnly = false;
  for (const row of result.results) {
    let images: string[] = [];
    try {
      images = JSON.parse(String(row.images ?? "[]")) as string[];
    } catch {
      continue;
    }
    const imageIndex = images.findIndex((image) => uploadedObjectKey(image)?.key === key);
    if (imageIndex < 0) continue;
    if (row.status !== "published") {
      memberOnly = true;
      continue;
    }
    if (row.type !== "gallery" || imageIndex === 0) return "public";
    memberOnly = true;
  }
  return memberOnly ? "member" : "unreferenced";
}

export async function deleteUploadedImages(images: string[]) {
  const objects = images.map(uploadedObjectKey).filter((item) => item !== null);
  const externalKeys = objects
    .filter((item) => item.store === "external")
    .map((item) => item.key);
  if (externalKeys.length) await deleteExternalObjects(externalKeys);
}

export async function createContentPost(input: ContentPostInput, audit?: AdminAuditInput) {
  await ensureContentStore();
  const db = getD1();
  const id = crypto.randomUUID();
  const statement = db.prepare(
      `INSERT INTO content_posts
      (id, type, title, date, excerpt, category, content, images, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      input.type,
      input.title,
      input.date,
      input.excerpt,
      input.category,
      input.content,
      JSON.stringify(input.images),
      input.status,
      input.sortOrder,
    );
  if (audit) await db.batch([statement, adminAuditStatement({ ...audit, targetId: id })]);
  else await statement.run();
  return id;
}

export async function updateContentPost(id: string, input: ContentPostInput, audit?: AdminAuditInput) {
  await ensureContentStore();
  const db = getD1();
  const statement = db.prepare(
      `UPDATE content_posts SET
        type = ?, title = ?, date = ?, excerpt = ?, category = ?,
        content = ?, images = ?, status = ?, sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    ).bind(
      input.type,
      input.title,
      input.date,
      input.excerpt,
      input.category,
      input.content,
      JSON.stringify(input.images),
      input.status,
      input.sortOrder,
      id,
    );
  if (audit) await db.batch([statement, adminAuditStatement({ ...audit, targetId: id })]);
  else await statement.run();
}

export async function deleteContentPost(id: string, audit?: AdminAuditInput) {
  await ensureContentStore();
  const db = getD1();
  const statement = db.prepare("DELETE FROM content_posts WHERE id = ?").bind(id);
  if (audit) await db.batch([statement, adminAuditStatement({ ...audit, targetId: id })]);
  else await statement.run();
}
