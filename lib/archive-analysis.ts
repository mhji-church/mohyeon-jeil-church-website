import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";
import type {
  ArchiveAnalysisSong,
  ArchiveAnalysisSource,
  ArchiveAnalysisStatus,
  ArchiveVideoAnalysis,
} from "./archive-shared";

export const ARCHIVE_ANALYSIS_VERSION = "manual-entry-v1";

type Row = Record<string, unknown>;

function numberOrNull(value: unknown) {
  return value == null ? null : Number(value);
}

function bool(value: unknown) {
  return Number(value ?? 0) === 1;
}

function asStatus(value: unknown): ArchiveAnalysisStatus {
  const status = String(value ?? "not_started");
  return ["not_started", "queued", "processing", "completed", "needs_review", "failed", "cancelled"].includes(status)
    ? (status as ArchiveAnalysisStatus)
    : "not_started";
}

function mapSong(row: Row): ArchiveAnalysisSong {
  return {
    id: String(row.id),
    order: Number(row.sort_order ?? 0),
    title: String(row.title ?? ""),
    category: String(row.category ?? "opening") as ArchiveAnalysisSong["category"],
    hymnNumber: numberOrNull(row.hymn_number),
    startSeconds: numberOrNull(row.start_seconds),
    endSeconds: numberOrNull(row.end_seconds),
    confidence: Number(row.confidence ?? 1),
    source: String(row.source ?? "manual") as ArchiveAnalysisSource,
    manuallyEdited: bool(row.manually_edited),
    evidence: String(row.evidence ?? ""),
  };
}

function mapAnalysis(row: Row | null, songs: ArchiveAnalysisSong[]): ArchiveVideoAnalysis | null {
  if (!row) return null;
  return {
    status: asStatus(row.status),
    analysisVersion: String(row.analysis_version ?? ARCHIVE_ANALYSIS_VERSION),
    analyzedAt: row.analyzed_at == null ? null : String(row.analyzed_at),
    analysisError: row.analysis_error == null ? null : String(row.analysis_error),
    overallConfidence: numberOrNull(row.overall_confidence),
    manualVerifiedAt: row.manual_verified_at == null ? null : String(row.manual_verified_at),
    manualVerifiedBy: row.manual_verified_by == null ? null : String(row.manual_verified_by),
    songs,
    sermon: {
      title: row.sermon_title == null ? null : String(row.sermon_title),
      biblePassage: row.sermon_bible_passage == null ? null : String(row.sermon_bible_passage),
      preacher: row.sermon_preacher == null ? null : String(row.sermon_preacher),
      startSeconds: numberOrNull(row.sermon_start_seconds),
      confidence: numberOrNull(row.sermon_confidence),
      manuallyEdited: bool(row.sermon_manually_edited),
    },
    representativePrayer: {
      name: row.prayer_name == null ? null : String(row.prayer_name),
      role: row.prayer_role == null ? null : String(row.prayer_role),
      startSeconds: numberOrNull(row.prayer_start_seconds),
      confidence: numberOrNull(row.prayer_confidence),
      manuallyEdited: bool(row.prayer_manually_edited),
    },
  };
}

export async function getArchiveVideoAnalysis(videoId: string, publicOnly = false) {
  await ensureNetlifySchema();
  const db = getNetlifyDb();
  const row = await db.prepare("SELECT * FROM archive_video_analyses WHERE video_id = ?").bind(videoId).first<Row>();
  const legacyRows = await db
    .prepare("SELECT * FROM archive_analysis_songs WHERE video_id = ? ORDER BY sort_order ASC, created_at ASC")
    .bind(videoId)
    .all<Row>();
  const catalogRows = await db
    .prepare(`SELECT vs.id, vs.sort_order, s.display_title AS title
      FROM archive_video_songs vs
      JOIN archive_songs s ON s.id = vs.song_id
      WHERE vs.video_id = ?
      ORDER BY vs.sort_order ASC, vs.created_at ASC`)
    .bind(videoId)
    .all<Row>();
  const songs = catalogRows.results.length
    ? catalogRows.results.map((item) => mapSong({ ...item, category: "opening", confidence: 1, source: "manual", manually_edited: 1, evidence: "찬양곡 데이터베이스" }))
    : legacyRows.results.map(mapSong);
  const analysis = mapAnalysis(row, songs);
  if (!analysis || !publicOnly) return analysis;
  return analysis.manualVerifiedAt ? analysis : null;
}

export async function attachArchiveAnalyses<T extends { id: string }>(videos: T[], publicOnly = false) {
  const attached: Array<T & { analysis: ArchiveVideoAnalysis | null }> = [];
  for (const video of videos) attached.push({ ...video, analysis: await getArchiveVideoAnalysis(video.id, publicOnly) });
  return attached;
}

function confidenceFrom(analysis: ArchiveVideoAnalysis) {
  const values = [
    ...analysis.songs.map((song) => song.confidence),
    analysis.sermon.confidence,
    analysis.representativePrayer.confidence,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return 1;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export async function saveArchiveVideoAnalysis(videoId: string, analysis: ArchiveVideoAnalysis, admin: string) {
  await ensureNetlifySchema();
  const db = getNetlifyDb();
  await db
    .prepare(`INSERT INTO archive_video_analyses
      (video_id, status, analysis_version, analyzed_at, analysis_error, overall_confidence, manual_verified_at, manual_verified_by, sermon_title, sermon_bible_passage, sermon_preacher, sermon_start_seconds, sermon_confidence, sermon_manually_edited, prayer_name, prayer_role, prayer_start_seconds, prayer_confidence, prayer_manually_edited, raw_evidence_json, cost_json, updated_at)
      VALUES (?, 'completed', ?, CURRENT_TIMESTAMP, NULL, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, NULL, 1, 1, ?, ?, NULL, 1, 1, '{}', '{"externalAiCalls":0}', CURRENT_TIMESTAMP)
      ON CONFLICT(video_id) DO UPDATE SET status = 'completed', analysis_version = excluded.analysis_version, analyzed_at = CURRENT_TIMESTAMP, analysis_error = NULL, overall_confidence = excluded.overall_confidence, manual_verified_at = CURRENT_TIMESTAMP, manual_verified_by = excluded.manual_verified_by, sermon_title = excluded.sermon_title, sermon_bible_passage = excluded.sermon_bible_passage, sermon_preacher = excluded.sermon_preacher, sermon_start_seconds = NULL, sermon_confidence = 1, sermon_manually_edited = 1, prayer_name = excluded.prayer_name, prayer_role = excluded.prayer_role, prayer_start_seconds = NULL, prayer_confidence = 1, prayer_manually_edited = 1, updated_at = CURRENT_TIMESTAMP`)
    .bind(
      videoId,
      ARCHIVE_ANALYSIS_VERSION,
      confidenceFrom(analysis),
      admin,
      analysis.sermon.title,
      analysis.sermon.biblePassage,
      analysis.sermon.preacher,
      analysis.representativePrayer.name,
      analysis.representativePrayer.role,
    )
    .run();
  await db.prepare("DELETE FROM archive_analysis_songs WHERE video_id = ?").bind(videoId).run();
  for (const [index, song] of analysis.songs.entries()) {
    if (!song.title.trim() || song.category === "offertory") continue;
    await db
      .prepare(`INSERT INTO archive_analysis_songs
        (id, video_id, sort_order, title, category, hymn_number, start_seconds, end_seconds, confidence, source, manually_edited, evidence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1, 'manual', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .bind(song.id || crypto.randomUUID(), videoId, index + 1, song.title.trim(), song.category, song.hymnNumber, song.evidence || "관리자 직접 입력")
      .run();
  }
  return getArchiveVideoAnalysis(videoId);
}
