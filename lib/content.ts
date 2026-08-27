import { deleteExternalObjects } from "./external-r2";
import { externalMediaKey, externalMediaUrl } from "./media-path";
import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";
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

const schemaStatement = `CREATE TABLE IF NOT EXISTS content_posts (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const seedPosts: ContentPostInput[] = [
  ...[
    ["2026년 6월 7일 주보", "2026.06.07", "260607"],
    ["2026년 5월 31일 주보", "2026.05.31", "260531"],
    ["2026년 5월 24일 주보", "2026.05.24", "260524"],
    ["2026년 5월 17일 주보", "2026.05.17", "260517"],
    ["2026년 5월 10일 주보", "2026.05.10", "260510"],
    ["2026년 5월 3일 주보", "2026.05.03", "260503"],
    ["2026년 4월 26일 주보", "2026.04.26", "260426"],
    ["2026년 4월 19일 주보", "2026.04.19", "260419"],
    ["2026년 4월 12일 주보", "2026.04.12", "260412"],
    ["2026년 4월 5일 주보", "2026.04.05", "260405"],
  ].map(([title, date, code], index) => ({
    type: "bulletin" as const,
    title,
    date,
    excerpt: "",
    category: "",
    content: "",
    images: [
      `/assets/mhji/bulletin-${code}-1.jpg`,
      `/assets/mhji/bulletin-${code}-2.jpg`,
    ],
    status: "published" as const,
    sortOrder: 100 - index,
  })),
  ...[
    {
      date: "2026.06.07",
      title: "2026년 6월 7일 교회소식",
      items: [
        ["월삭감사예배", "오늘은 6월 월삭감사주일로 지키며 예배 시 성찬예식이 있습니다."],
        ["생신상 차림 행사", "11일 목요일, 모현읍 지역사회보장협의체 ‘홀로 어르신 생신축하 사업’을 생신상 차림으로 섬깁니다."],
        ["모임", "다음 주 14일 2부 예배 후 권사회 월례회가 있습니다."],
        ["핑크뮬리 정원 조성", "교회 밭에 핑크뮬리를 심었습니다. 물질과 손길로 섬겨주신 모든 성도님께 감사드립니다."],
        ["시설 개선 공사", "식당, 유초등부실, 청년부실 인테리어와 본당 음향 시설 개선 공사가 진행됩니다."],
      ],
    },
    {
      date: "2026.05.31",
      title: "2026년 5월 31일 교회소식",
      items: [
        ["월삭감사예배", "다음 주 6월 7일은 월삭감사주일로 지키며 예배 시 성찬예식이 있습니다."],
        ["모임", "모든 순서를 마친 후 남전도회 모임이 있습니다."],
        ["지방선거", "지역과 위정자, 정직하고 평화로운 선거 과정과 분별력 있는 참여를 위해 함께 기도합니다."],
      ],
    },
    {
      date: "2026.05.24",
      title: "2026년 5월 24일 교회소식",
      items: [
        ["청소년·청년 주일", "청소년과 청년들의 비전과 꿈, 취업과 학업을 위해 기도해 주시기 바랍니다."],
        ["생신상 차림 행사", "29일 금요일, ‘홀로 어르신 생신축하 사업’을 생신상 차림으로 섬깁니다."],
        ["카페 이용 안내", "온수는 커피머신을 이용하고 얼음이 필요할 때는 카페지기에게 요청해 주세요."],
      ],
    },
    {
      date: "2026.05.17",
      title: "2026년 5월 17일 교회소식",
      items: [
        ["스승의 주일", "신앙과 삶의 스승, 교회학교 교사에게 감사와 축복을 전합니다."],
        ["교회 안내 표지판", "교회 진입로에 안내 표지판을 설치했습니다."],
        ["청소년·청년 주일", "다음 주 24일은 청소년·청년 주일로 지킵니다."],
      ],
    },
    {
      date: "2026.05.10",
      title: "2026년 5월 10일 교회소식",
      items: [
        ["어버이주일", "특별한 식사를 준비했으며 65세 이상 부모님께 카네이션 브로치를 달아 드립니다."],
        ["스승의 주일", "다음 주 17일은 스승의 주일로 지킵니다."],
      ],
    },
    {
      date: "2026.05.03",
      title: "2026년 5월 3일 교회소식",
      items: [
        ["어린이주일·월삭감사주일", "오늘은 어린이주일과 5월 월삭감사주일로 지킵니다."],
        ["어버이주일", "다음 주는 어버이주일로 지킵니다."],
        ["모임", "은혜의 울림 모임이 오늘 오후에 있습니다."],
      ],
    },
    {
      date: "2026.04.26",
      title: "2026년 4월 26일 교회소식",
      items: [
        ["생신상 차림 행사", "30일 목요일, ‘홀로 어르신 생신축하 사업’을 생신상 차림으로 섬깁니다."],
        ["영아유치부 야외 나들이", "5월 1일 오전 9시 30분 교회에서 예배 후 용인 농촌테마파크로 출발합니다."],
        ["모임", "소망 워십 모임이 2부 예배 후 있습니다."],
      ],
    },
    {
      date: "2026.04.19",
      title: "2026년 4월 19일 교회소식",
      items: [
        ["전교인 봄나들이", "27명의 성도와 함께 여주 황학산 수목원을 다녀왔습니다."],
        ["결혼", "안예찬 형제와 장해주 자매의 결혼예식이 25일 토요일 낮 12시 본 교회에서 있습니다."],
        ["모임", "남전도회 모임이 2부 예배 후 본당에서 있습니다."],
      ],
    },
  ].map((post, index) => ({
    type: "news" as const,
    title: post.title,
    date: post.date,
    excerpt: post.items[0]?.[1] ?? "",
    category: "",
    content: JSON.stringify(post.items),
    images: [],
    status: "published" as const,
    sortOrder: 100 - index,
  })),
  {
    type: "gallery",
    title: "핑크뮬리 정원 조성",
    date: "2026.06.15",
    excerpt: "성도님들의 손길로 교회 밭에 핑크뮬리를 심었습니다.",
    category: "COMMUNITY & SERVICE",
    content:
      "지난 수요일, 교회 밭에 핑크뮬리를 심었습니다. 함께 섬겨주신 성도님들의 손길로 교회 주변이 조금씩 아름다운 정원으로 준비되고 있습니다. 앞으로 자라날 핑크뮬리 정원을 기대하며 함께 기도해 주세요.",
    images: [
      "/assets/mhji/gallery-pink-01.jpg",
      "/assets/mhji/gallery-pink-02.jpg",
      "/assets/mhji/gallery-pink-03.jpg",
      "/assets/mhji/gallery-pink-04.jpg",
    ],
    status: "published",
    sortOrder: 100,
  },
];

function getD1() {
  return getNetlifyDb();
}

let contentStoreReady = false;

export async function ensureContentStore() {
  await ensureNetlifySchema();
  if (contentStoreReady) {
    getD1();
    return;
  }

  // Never cache a D1-backed Promise in module state. Cloudflare can reuse the
  // isolate for another request after the original request is cancelled,
  // leaving every later content query waiting on an abandoned Promise.
  const db = getD1();
  await db.prepare(schemaStatement).run();
  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS content_posts_type_date_idx ON content_posts(type, date DESC)",
    )
    .run();
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM content_posts")
    .first<{ count: number }>();
  if ((count?.count ?? 0) === 0) {
    const statements = seedPosts.map((post, index) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO content_posts
          (id, type, title, date, excerpt, category, content, images, status, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          `seed-${post.type}-${index + 1}`,
          post.type,
          post.title,
          post.date,
          post.excerpt,
          post.category,
          post.content,
          JSON.stringify(post.images),
          post.status,
          post.sortOrder,
        ),
    );
    await db.batch(statements);
  }
  contentStoreReady = true;
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

export async function createContentPost(input: ContentPostInput) {
  await ensureContentStore();
  const db = getD1();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO content_posts
      (id, type, title, date, excerpt, category, content, images, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
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
    )
    .run();
  return id;
}

export async function updateContentPost(id: string, input: ContentPostInput) {
  await ensureContentStore();
  const db = getD1();
  await db
    .prepare(
      `UPDATE content_posts SET
        type = ?, title = ?, date = ?, excerpt = ?, category = ?,
        content = ?, images = ?, status = ?, sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    )
    .bind(
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
    )
    .run();
}

export async function deleteContentPost(id: string) {
  await ensureContentStore();
  await getD1().prepare("DELETE FROM content_posts WHERE id = ?").bind(id).run();
}
