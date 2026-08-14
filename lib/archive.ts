import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";
import type { ArchiveAccessLevel, ArchiveVideo, ArchiveVideoAdmin, ArchiveVideoType } from "./archive-shared";

export type { ArchiveAccessLevel, ArchiveVideo, ArchiveVideoAdmin, ArchiveVideoType } from "./archive-shared";

export const ARCHIVE_APP_CODE = "worship_archive";

type Row = Record<string, unknown>;

function mapVideo(row: Row): ArchiveVideoAdmin {
  return {
    id: String(row.id),
    type: row.type as ArchiveVideoType,
    date: String(row.date),
    serviceType: String(row.service_type),
    title: String(row.title),
    preacher: String(row.preacher ?? ""),
    youtubeId: String(row.youtube_id),
    youtubeUrl: String(row.youtube_url),
    thumbnailUrl: String(row.thumbnail_url ?? ""),
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    note: String(row.note ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function extractYouTubeId(value: string) {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0] ?? "")) return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function listArchiveVideos(options: {
  type?: ArchiveVideoType;
  serviceGroup?: "sunday" | "other";
  search?: string;
  year?: string;
  month?: string;
  sort?: "newest" | "oldest";
  page?: number;
  pageSize?: number;
} = {}) {
  await ensureNetlifySchema();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (options.type) {
    where.push("type = ?");
    args.push(options.type);
  }
  if (options.serviceGroup === "sunday") {
    where.push("service_type IN ('주일 1부 예배', '주일 2부 예배')");
  } else if (options.serviceGroup === "other") {
    where.push("service_type IN ('수요예배', '특별예배')");
  }
  if (options.search?.trim()) {
    where.push("(date LIKE ? OR service_type LIKE ? OR title LIKE ? OR preacher LIKE ? OR note LIKE ?)");
    const term = `%${options.search.trim()}%`;
    args.push(term, term, term, term, term);
  }
  if (options.year && /^\d{4}$/.test(options.year)) {
    where.push("substr(date, 1, 4) = ?");
    args.push(options.year);
  }
  if (options.month && /^(?:[1-9]|1[0-2])$/.test(options.month)) {
    where.push("substr(date, 6, 2) = ?");
    args.push(options.month.padStart(2, "0"));
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 8));
  const page = Math.max(1, options.page ?? 1);
  const direction = options.sort === "oldest" ? "ASC" : "DESC";
  const db = getNetlifyDb();
  const totalRow = await db.prepare(`SELECT COUNT(*) AS count FROM archive_videos ${clause}`).bind(...args).first<{ count: number }>();
  const result = await db
    .prepare(`SELECT * FROM archive_videos ${clause} ORDER BY date ${direction}, CASE service_type WHEN '주일 2부 예배' THEN 0 WHEN '주일 1부 예배' THEN 1 ELSE 2 END, created_at ${direction} LIMIT ? OFFSET ?`)
    .bind(...args, pageSize, (page - 1) * pageSize)
    .all<Row>();
  return {
    videos: result.results.map(mapVideo),
    total: Number(totalRow?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getArchiveVideo(id: string) {
  await ensureNetlifySchema();
  const row = await getNetlifyDb().prepare("SELECT * FROM archive_videos WHERE id = ?").bind(id).first<Row>();
  return row ? mapVideo(row) : null;
}

export async function getArchiveAccess(memberId: string): Promise<ArchiveAccessLevel> {
  await ensureNetlifySchema();
  const row = await getNetlifyDb()
    .prepare("SELECT access_level FROM member_app_access WHERE member_id = ? AND app_code = ?")
    .bind(memberId, ARCHIVE_APP_CODE)
    .first<{ access_level: ArchiveAccessLevel }>();
  return row?.access_level ?? "none";
}

export function canPlayArchiveVideo(level: ArchiveAccessLevel, type: ArchiveVideoType) {
  if (level === "full") return true;
  return level === "worship" && type === "worship";
}

export async function setArchiveAccess(memberId: string, level: ArchiveAccessLevel, adminUsername: string) {
  await ensureNetlifySchema();
  await getNetlifyDb()
    .prepare(`INSERT INTO member_app_access (member_id, app_code, access_level, granted_by, granted_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(member_id, app_code) DO UPDATE SET access_level = excluded.access_level, granted_by = excluded.granted_by, granted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`)
    .bind(memberId, ARCHIVE_APP_CODE, level, adminUsername)
    .run();
}

export async function upsertArchiveVideo(input: Omit<ArchiveVideoAdmin, "createdAt" | "updatedAt">) {
  await ensureNetlifySchema();
  const youtubeId = extractYouTubeId(input.youtubeUrl);
  if (!youtubeId || youtubeId.length !== 11) throw new Error("올바른 유튜브 URL을 입력해 주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("영상 날짜를 확인해 주세요.");
  if (!input.title.trim() || !input.serviceType.trim()) throw new Error("영상 제목과 예배 종류를 입력해 주세요.");
  await getNetlifyDb()
    .prepare(`INSERT INTO archive_videos (id, type, date, service_type, title, preacher, youtube_id, youtube_url, thumbnail_url, duration_seconds, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET type = excluded.type, date = excluded.date, service_type = excluded.service_type, title = excluded.title, preacher = excluded.preacher, youtube_id = excluded.youtube_id, youtube_url = excluded.youtube_url, thumbnail_url = excluded.thumbnail_url, duration_seconds = excluded.duration_seconds, note = excluded.note, updated_at = CURRENT_TIMESTAMP`)
    .bind(input.id, input.type, input.date, input.serviceType.trim(), input.title.trim(), input.preacher.trim(), youtubeId, input.youtubeUrl.trim(), input.thumbnailUrl.trim(), input.durationSeconds, input.note.trim())
    .run();
}

export async function deleteArchiveVideo(id: string) {
  await ensureNetlifySchema();
  await getNetlifyDb().prepare("DELETE FROM archive_videos WHERE id = ?").bind(id).run();
}
