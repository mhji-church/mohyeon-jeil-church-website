import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url || !authToken) throw new Error("TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN이 필요합니다.");
const db = createClient({ url, authToken });
const normalize = (value) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").replace(/\s+\(/gu, "(").replace(/\(\s+/gu, "(").replace(/\s+\)/gu, ")").toLocaleLowerCase("ko-KR");
const parse = (value) => { const display = value.normalize("NFKC").trim().replace(/\s+/gu, " ").replace(/\s+\(/gu, "("); const match = display.match(/^(.+?)\s*\(([^()]*)\)\s*$/u); const base = (match?.[1] ?? display).trim(); const alias = match?.[2]?.trim() ?? ""; return { display: alias ? `${base}(${alias})` : base, base, normalized: normalize(base), alias }; };

try {
  const rows = await db.execute(`SELECT a.video_id, a.sort_order, a.title FROM archive_analysis_songs a JOIN archive_videos v ON v.id = a.video_id WHERE v.type = 'worship' AND a.category <> 'offertory' ORDER BY a.video_id, a.sort_order`);
  let linked = 0;
  for (const row of rows.rows) {
    const song = parse(String(row.title ?? "")); if (!song.base) continue;
    const normalizedAlias = song.alias ? normalize(song.alias) : "";
    const candidates = await db.execute({ sql: `SELECT DISTINCT s.id, s.normalized_base_title FROM archive_songs s LEFT JOIN archive_song_names n ON n.song_id = s.id WHERE s.normalized_base_title = ? OR n.normalized_alias IN (?, ?)`, args: [song.normalized, song.normalized, normalizedAlias] });
    const exact = candidates.rows.filter((item) => String(item.normalized_base_title) === song.normalized);
    let songId = String(exact[0]?.id ?? (!song.alias && candidates.rows.length === 1 ? candidates.rows[0]?.id : ""));
    if (candidates.rows.length > 1 || (song.alias && candidates.rows.length && !exact.length)) {
      await db.execute({ sql: "INSERT INTO archive_song_conflicts (id, input_title, normalized_value, candidate_song_ids_json) VALUES (?, ?, ?, ?)", args: [randomUUID(), song.display, song.normalized, JSON.stringify(candidates.rows.map((item) => String(item.id)))] });
    }
    if (!songId) {
      songId = randomUUID();
      await db.execute({ sql: "INSERT OR IGNORE INTO archive_songs (id, display_title, base_title, normalized_base_title) VALUES (?, ?, ?, ?)", args: [songId, song.display, song.base, song.normalized] });
      const master = await db.execute({ sql: "SELECT id FROM archive_songs WHERE normalized_base_title = ? LIMIT 1", args: [song.normalized] });
      songId = String(master.rows[0]?.id ?? songId);
    }
    if (song.alias) {
      const aliasCollision = await db.execute({ sql: "SELECT song_id FROM archive_song_names WHERE normalized_alias = ? AND song_id <> ? LIMIT 1", args: [normalizedAlias, songId] });
      if (!aliasCollision.rows.length) await db.execute({ sql: "INSERT OR IGNORE INTO archive_song_names (id, song_id, alias_text, normalized_alias) VALUES (?, ?, ?, ?)", args: [randomUUID(), songId, song.alias, normalizedAlias] });
    }
    await db.execute({ sql: "INSERT OR IGNORE INTO archive_video_songs (id, video_id, song_id, sort_order) VALUES (?, ?, ?, ?)", args: [randomUUID(), String(row.video_id), songId, Number(row.sort_order ?? 0)] });
    linked += 1;
  }
  console.log(`찬양 백필 완료: ${linked}개 기존 연결을 비파괴적으로 확인했습니다.`);
} finally { db.close(); }
