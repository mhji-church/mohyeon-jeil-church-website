import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";
import { dedupeSongTitles, normalizeSongTitle, type ParsedSongTitle } from "./archive-song-parser";

type Row = Record<string, unknown>;
export type SongServiceFilter = "all" | "sunday1" | "sunday2" | "wednesday";
export type SongPeriodFilter = { mode: "all" | "year" | "last12" | "custom"; year?: number; start?: string; end?: string };
export type SongStatsOptions = { service: SongServiceFilter; period: SongPeriodFilter; limit: number | null; search?: string };

function placeholders(count: number) { return Array.from({ length: count }, () => "?").join(","); }
function asString(value: unknown) { return value == null ? "" : String(value); }
function serviceValue(service: SongServiceFilter) {
  if (service === "sunday1") return "주일 1부 예배";
  if (service === "sunday2") return "주일 2부 예배";
  if (service === "wednesday") return "수요예배";
  return "";
}

async function recordConflict(input: ParsedSongTitle, ids: string[]) {
  const db = getNetlifyDb();
  await db.prepare(`INSERT INTO archive_song_conflicts (id, input_title, normalized_value, candidate_song_ids_json) VALUES (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), input.displayTitle, input.normalizedBaseTitle, JSON.stringify(ids)).run();
}

async function findSongCandidates(song: ParsedSongTitle) {
  const keys = [...new Set([song.normalizedBaseTitle, ...song.normalizedAliases, normalizeSongTitle(song.displayTitle)])];
  const db = getNetlifyDb();
  const rows = await db.prepare(`SELECT DISTINCT s.* FROM archive_songs s LEFT JOIN archive_song_names n ON n.song_id = s.id WHERE s.normalized_base_title IN (${placeholders(keys.length)}) OR n.normalized_alias IN (${placeholders(keys.length)})`).bind(...keys, ...keys).all<Row>();
  return rows.results;
}

async function resolveSong(song: ParsedSongTitle) {
  const db = getNetlifyDb();
  const candidates = await findSongCandidates(song);
  const exactBase = candidates.filter((row) => asString(row.normalized_base_title) === song.normalizedBaseTitle);
  let target = exactBase[0] ?? (song.aliases.length ? undefined : candidates[0]);
  if (candidates.length > 1 || (song.aliases.length && candidates.length && !exactBase.length)) {
    await recordConflict(song, candidates.map((row) => asString(row.id)));
  }
  if (!target) {
    const id = crypto.randomUUID();
    await db.prepare(`INSERT INTO archive_songs (id, display_title, base_title, normalized_base_title) VALUES (?, ?, ?, ?)`).bind(id, song.displayTitle, song.baseTitle, song.normalizedBaseTitle).run();
    target = { id, display_title: song.displayTitle, base_title: song.baseTitle, normalized_base_title: song.normalizedBaseTitle };
  } else if (song.aliases.length && !asString(target.display_title).includes("(")) {
    await db.prepare(`UPDATE archive_songs SET display_title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(song.displayTitle, asString(target.id)).run();
  }
  const targetId = asString(target.id);
  for (const aliasText of song.aliases) {
    const normalized = normalizeSongTitle(aliasText);
    const collision = await db.prepare(`SELECT song_id FROM archive_song_names WHERE normalized_alias = ? AND song_id <> ? LIMIT 1`).bind(normalized, targetId).first<Row>();
    if (collision) {
      await recordConflict(song, [targetId, asString(collision.song_id)]);
      continue;
    }
    await db.prepare(`INSERT OR IGNORE INTO archive_song_names (id, song_id, alias_text, normalized_alias) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), targetId, aliasText, normalized).run();
  }
  return targetId;
}

export async function syncArchiveVideoSongs(videoId: string, titles: string[]) {
  await ensureNetlifySchema();
  const songs = dedupeSongTitles(titles);
  const resolved: Array<{ songId: string; order: number }> = [];
  const seen = new Set<string>();
  for (const song of songs) {
    const songId = await resolveSong(song);
    if (seen.has(songId)) continue;
    seen.add(songId);
    resolved.push({ songId, order: resolved.length + 1 });
  }
  const db = getNetlifyDb();
  const statements = [db.prepare("DELETE FROM archive_video_songs WHERE video_id = ?").bind(videoId)];
  for (const item of resolved) statements.push(db.prepare(`INSERT INTO archive_video_songs (id, video_id, song_id, sort_order) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), videoId, item.songId, item.order));
  await db.batch(statements);
  return resolved;
}

export async function deleteArchiveVideoSongLinks(videoId: string) {
  await ensureNetlifySchema();
  await getNetlifyDb().prepare("DELETE FROM archive_video_songs WHERE video_id = ?").bind(videoId).run();
}

export async function searchArchiveSongs(query = "", limit = 20) {
  await ensureNetlifySchema();
  const normalized = normalizeSongTitle(query);
  const like = `%${query.trim()}%`;
  const normalizedLike = `%${normalized}%`;
  const rows = await getNetlifyDb().prepare(`SELECT s.id, s.display_title, s.base_title, s.normalized_base_title, COUNT(DISTINCT vs.video_id) AS usage_count, GROUP_CONCAT(DISTINCT n.alias_text) AS aliases
    FROM archive_songs s LEFT JOIN archive_song_names n ON n.song_id = s.id LEFT JOIN archive_video_songs vs ON vs.song_id = s.id
    WHERE ? = '' OR s.display_title LIKE ? OR s.base_title LIKE ? OR s.normalized_base_title LIKE ? OR n.alias_text LIKE ? OR n.normalized_alias LIKE ?
    GROUP BY s.id ORDER BY usage_count DESC, s.display_title ASC LIMIT ?`).bind(query.trim(), like, like, normalizedLike, like, normalizedLike, Math.min(100, Math.max(1, limit))).all<Row>();
  return rows.results.map((row) => ({ id: asString(row.id), displayTitle: asString(row.display_title), baseTitle: asString(row.base_title), aliases: asString(row.aliases).split(",").filter(Boolean), usageCount: Number(row.usage_count ?? 0) }));
}

export async function getArchiveSongConflicts(limit = 50) {
  await ensureNetlifySchema();
  const rows = await getNetlifyDb().prepare(`SELECT c.id, c.input_title, c.normalized_value, c.candidate_song_ids_json, c.status, c.created_at,
      GROUP_CONCAT(s.display_title, ' / ') AS candidate_titles
    FROM archive_song_conflicts c
    LEFT JOIN json_each(c.candidate_song_ids_json) candidate
    LEFT JOIN archive_songs s ON s.id = candidate.value
    WHERE c.status = 'open'
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT ?`).bind(Math.min(100, Math.max(1, limit))).all<Row>();
  return rows.results.map((row) => ({
    id: asString(row.id),
    inputTitle: asString(row.input_title),
    normalizedValue: asString(row.normalized_value),
    candidateIds: (() => { try { return JSON.parse(asString(row.candidate_song_ids_json)) as string[]; } catch { return []; } })(),
    candidateTitles: asString(row.candidate_titles),
    createdAt: asString(row.created_at),
  }));
}

export async function resolveArchiveSongConflict(id: string) {
  await ensureNetlifySchema();
  const result = await getNetlifyDb().prepare("UPDATE archive_song_conflicts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'open'").bind(id).run();
  if (Number(result.meta.changes ?? 0) === 0) throw new Error("확인할 충돌 기록을 찾을 수 없습니다.");
}

function statsWhere(options: SongStatsOptions) {
  const clauses = ["v.type = 'worship'"];
  const args: Array<string | number> = [];
  const service = serviceValue(options.service);
  if (service) { clauses.push("v.service_type = ?"); args.push(service); }
  if (options.period.mode === "year" && options.period.year) { clauses.push("substr(v.date, 1, 4) = ?"); args.push(String(options.period.year)); }
  else if (options.period.mode === "last12") { clauses.push("date(v.date) >= date('now', '-12 months')"); }
  else if (options.period.mode === "custom") {
    if (options.period.start) { clauses.push("v.date >= ?"); args.push(options.period.start); }
    if (options.period.end) { clauses.push("v.date <= ?"); args.push(options.period.end); }
  }
  if (options.search?.trim()) {
    const value = `%${options.search.trim()}%`; const normalized = `%${normalizeSongTitle(options.search)}%`;
    clauses.push("(s.display_title LIKE ? OR s.base_title LIKE ? OR s.normalized_base_title LIKE ? OR EXISTS (SELECT 1 FROM archive_song_names sn WHERE sn.song_id = s.id AND (sn.alias_text LIKE ? OR sn.normalized_alias LIKE ?)))");
    args.push(value, value, normalized, value, normalized);
  }
  return { sql: clauses.join(" AND "), args };
}

export async function getArchiveSongStats(options: SongStatsOptions) {
  await ensureNetlifySchema();
  const db = getNetlifyDb();
  const where = statsWhere(options);
  const limitSql = options.limit == null ? "" : " LIMIT ?";
  const ranking = await db.prepare(`SELECT s.id, s.display_title, s.base_title, GROUP_CONCAT(DISTINCT n.alias_text) AS aliases,
      COUNT(DISTINCT vs.video_id) AS total_count,
      COUNT(DISTINCT CASE WHEN v.service_type = '주일 1부 예배' THEN vs.video_id END) AS sunday1_count,
      COUNT(DISTINCT CASE WHEN v.service_type = '주일 2부 예배' THEN vs.video_id END) AS sunday2_count,
      COUNT(DISTINCT CASE WHEN v.service_type = '수요예배' THEN vs.video_id END) AS wednesday_count,
      MAX(v.date) AS last_used
    FROM archive_video_songs vs JOIN archive_videos v ON v.id = vs.video_id JOIN archive_songs s ON s.id = vs.song_id LEFT JOIN archive_song_names n ON n.song_id = s.id
    WHERE ${where.sql} GROUP BY s.id ORDER BY total_count DESC, last_used DESC, s.display_title ASC${limitSql}`).bind(...where.args, ...(options.limit == null ? [] : [options.limit])).all<Row>();
  const rows = ranking.results.map((row, index) => ({ rank: index + 1, id: asString(row.id), displayTitle: asString(row.display_title), baseTitle: asString(row.base_title), aliases: asString(row.aliases).split(",").filter(Boolean), totalCount: Number(row.total_count), sunday1Count: Number(row.sunday1_count), sunday2Count: Number(row.sunday2_count), wednesdayCount: Number(row.wednesday_count), lastUsed: asString(row.last_used) }));
  const summary = await db.prepare(`SELECT COUNT(DISTINCT v.id) AS worship_count, COUNT(DISTINCT vs.song_id) AS song_count, COUNT(*) AS usage_count FROM archive_video_songs vs JOIN archive_videos v ON v.id = vs.video_id JOIN archive_songs s ON s.id = vs.song_id WHERE ${where.sql}`).bind(...where.args).first<Row>();
  const stale = await db.prepare(`SELECT s.id, s.display_title, COUNT(DISTINCT vs.video_id) AS total_count, MAX(v.date) AS last_used, CAST(julianday('now') - julianday(MAX(v.date)) AS INTEGER) AS days_since FROM archive_video_songs vs JOIN archive_videos v ON v.id = vs.video_id JOIN archive_songs s ON s.id = vs.song_id WHERE v.type = 'worship' GROUP BY s.id ORDER BY last_used ASC, s.display_title ASC LIMIT 50`).all<Row>();
  return { summary: { worshipCount: Number(summary?.worship_count ?? 0), songCount: Number(summary?.song_count ?? 0), usageCount: Number(summary?.usage_count ?? 0), topSong: rows[0]?.displayTitle ?? "-" }, rankings: rows, stale: stale.results.map((row) => ({ id: asString(row.id), displayTitle: asString(row.display_title), totalCount: Number(row.total_count), lastUsed: asString(row.last_used), daysSince: Number(row.days_since ?? 0) })) };
}

export async function getArchiveSongHistory(songId: string, options: SongStatsOptions) {
  await ensureNetlifySchema();
  const where = statsWhere({ ...options, search: "" });
  const rows = await getNetlifyDb().prepare(`SELECT v.id AS video_id, v.date, v.service_type, v.title AS video_title, v.youtube_url, vs.sort_order FROM archive_video_songs vs JOIN archive_videos v ON v.id = vs.video_id JOIN archive_songs s ON s.id = vs.song_id WHERE vs.song_id = ? AND ${where.sql} ORDER BY v.date DESC, vs.sort_order ASC`).bind(songId, ...where.args).all<Row>();
  return rows.results.map((row) => ({ videoId: asString(row.video_id), date: asString(row.date), serviceType: asString(row.service_type), videoTitle: asString(row.video_title), youtubeUrl: asString(row.youtube_url), order: Number(row.sort_order) }));
}

export async function getArchiveSongExportHistory(songIds: string[], options: SongStatsOptions) {
  if (!songIds.length) return [];
  await ensureNetlifySchema();
  const where = statsWhere({ ...options, search: "" });
  const rows = await getNetlifyDb().prepare(`SELECT s.display_title, v.id AS video_id, v.date, v.service_type, v.title AS video_title, vs.sort_order FROM archive_video_songs vs JOIN archive_videos v ON v.id = vs.video_id JOIN archive_songs s ON s.id = vs.song_id WHERE vs.song_id IN (${placeholders(songIds.length)}) AND ${where.sql} ORDER BY s.display_title ASC, v.date DESC, vs.sort_order ASC`).bind(...songIds, ...where.args).all<Row>();
  return rows.results.map((row) => ({ displayTitle: asString(row.display_title), videoId: asString(row.video_id), date: asString(row.date), serviceType: asString(row.service_type), videoTitle: asString(row.video_title), order: Number(row.sort_order) }));
}

export async function updateArchiveSong(input: { id: string; displayTitle: string; baseTitle: string; aliases: string[] }) {
  await ensureNetlifySchema();
  const parsed = dedupeSongTitles([input.displayTitle])[0];
  const normalizedBase = normalizeSongTitle(input.baseTitle || parsed?.baseTitle || input.displayTitle);
  const db = getNetlifyDb();
  const duplicate = await db.prepare("SELECT id FROM archive_songs WHERE normalized_base_title = ? AND id <> ? LIMIT 1").bind(normalizedBase, input.id).first<Row>();
  if (duplicate) throw new Error("같은 기본 제목의 찬양이 있습니다. 삭제 대신 병합해 주세요.");
  const aliases = [...new Set(input.aliases.map((item) => item.trim()).filter(Boolean))];
  for (const alias of aliases) {
    const collision = await db.prepare("SELECT song_id FROM archive_song_names WHERE normalized_alias = ? AND song_id <> ? LIMIT 1").bind(normalizeSongTitle(alias), input.id).first<Row>();
    if (collision) throw new Error(`'${alias}' 별칭이 다른 찬양에 연결되어 있습니다.`);
  }
  const statements = [
    db.prepare("UPDATE archive_songs SET display_title = ?, base_title = ?, normalized_base_title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(input.displayTitle.trim(), input.baseTitle.trim(), normalizedBase, input.id),
    db.prepare("DELETE FROM archive_song_names WHERE song_id = ?").bind(input.id),
  ];
  for (const alias of aliases) statements.push(db.prepare("INSERT INTO archive_song_names (id, song_id, alias_text, normalized_alias) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), input.id, alias, normalizeSongTitle(alias)));
  await db.batch(statements);
}

export async function mergeArchiveSongs(targetId: string, sourceId: string) {
  await ensureNetlifySchema();
  if (!targetId || !sourceId || targetId === sourceId) throw new Error("병합할 두 찬양을 확인해 주세요.");
  const db = getNetlifyDb();
  const [target, source] = await Promise.all([db.prepare("SELECT id FROM archive_songs WHERE id = ?").bind(targetId).first<Row>(), db.prepare("SELECT id FROM archive_songs WHERE id = ?").bind(sourceId).first<Row>()]);
  if (!target || !source) throw new Error("병합할 찬양을 찾을 수 없습니다.");
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO archive_song_names (id, song_id, alias_text, normalized_alias) SELECT lower(hex(randomblob(16))), ?, alias_text, normalized_alias FROM archive_song_names WHERE song_id = ?`).bind(targetId, sourceId),
    db.prepare(`INSERT OR IGNORE INTO archive_video_songs (id, video_id, song_id, sort_order, created_at) SELECT lower(hex(randomblob(16))), video_id, ?, sort_order, created_at FROM archive_video_songs WHERE song_id = ?`).bind(targetId, sourceId),
    db.prepare("DELETE FROM archive_video_songs WHERE song_id = ?").bind(sourceId),
    db.prepare("DELETE FROM archive_song_names WHERE song_id = ?").bind(sourceId),
    db.prepare("DELETE FROM archive_songs WHERE id = ?").bind(sourceId),
  ]);
}
