import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";

export type ArchiveSettings = { recentCount: 4 | 8 | 12; defaultSort: "newest" | "oldest"; defaultServiceType: string; defaultPreacher: string; autoInspectYoutube: boolean; afterSave: "list" | "continue" };
export const DEFAULT_ARCHIVE_SETTINGS: ArchiveSettings = { recentCount: 4, defaultSort: "newest", defaultServiceType: "주일 2부 예배", defaultPreacher: "담임목사", autoInspectYoutube: true, afterSave: "list" };

export async function getArchiveSettings(): Promise<ArchiveSettings> {
  await ensureNetlifySchema();
  const row = await getNetlifyDb().prepare("SELECT value FROM archive_settings WHERE key = 'global'").first<{ value: string }>();
  if (!row) return DEFAULT_ARCHIVE_SETTINGS;
  try { return validate({ ...DEFAULT_ARCHIVE_SETTINGS, ...JSON.parse(row.value) }); } catch { return DEFAULT_ARCHIVE_SETTINGS; }
}

export function validate(value: Record<string, unknown>): ArchiveSettings {
  const recentCount = [4, 8, 12].includes(Number(value.recentCount)) ? Number(value.recentCount) as 4 | 8 | 12 : 4;
  const defaultSort = value.defaultSort === "oldest" ? "oldest" : "newest";
  const defaultServiceType = ["주일 1부 예배", "주일 2부 예배", "수요예배", "특별예배"].includes(String(value.defaultServiceType)) ? String(value.defaultServiceType) : "주일 2부 예배";
  const defaultPreacher = String(value.defaultPreacher ?? "담임목사").trim().slice(0, 40) || "담임목사";
  return { recentCount, defaultSort, defaultServiceType, defaultPreacher, autoInspectYoutube: value.autoInspectYoutube !== false, afterSave: value.afterSave === "continue" ? "continue" : "list" };
}

export async function saveArchiveSettings(value: Record<string, unknown>, actor: string) {
  const settings = validate(value); await ensureNetlifySchema();
  await getNetlifyDb().prepare(`INSERT INTO archive_settings (key, value, updated_by, updated_at) VALUES ('global', ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`).bind(JSON.stringify(settings), actor).run();
  return settings;
}

export async function getArchiveSystemStatus() {
  await ensureNetlifySchema(); const db = getNetlifyDb();
  const totals = await db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN type='worship' THEN 1 ELSE 0 END) worship, SUM(CASE WHEN type='attendance' THEN 1 ELSE 0 END) attendance, MAX(updated_at) latest FROM archive_videos").first<Record<string, unknown>>();
  return { database: "connected", youtubeApi: Boolean(process.env.YOUTUBE_API_KEY?.trim()), total: Number(totals?.total ?? 0), worship: Number(totals?.worship ?? 0), attendance: Number(totals?.attendance ?? 0), latest: String(totals?.latest ?? "") };
}
