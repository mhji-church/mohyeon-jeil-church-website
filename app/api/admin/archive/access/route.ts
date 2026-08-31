import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { ARCHIVE_APP_CODE, ARCHIVE_SONG_STATS_APP_CODE, setArchiveAccess, setArchiveSongStatsAccess, type ArchiveAccessLevel } from "@/lib/archive";
import { ensureNetlifySchema, getNetlifyDb } from "@/lib/netlify-db";
import { getMember } from "@/lib/members";
import { recordArchiveAudit } from "@/lib/archive-audit";

const LEVELS = new Set<ArchiveAccessLevel>(["none", "worship", "full"]);

export async function GET() {
  if (!(await requireArchiveAdminApi())) return Response.json({ error: "아카이브 관리자 권한이 필요합니다." }, { status: 403 });
  await ensureNetlifySchema();
  const result = await getNetlifyDb().prepare(`SELECT members.id, members.name, members.username, members.status,
    COALESCE(archive_access.access_level, 'none') AS access_level,
    CASE WHEN COALESCE(archive_access.access_level, 'none') NOT IN ('worship', 'full') THEN 0
      WHEN song_access.access_level IS NULL THEN 1
      WHEN song_access.access_level = 'full' THEN 1 ELSE 0 END AS song_stats_allowed
    FROM members
    LEFT JOIN member_app_access archive_access ON archive_access.member_id = members.id AND archive_access.app_code = ?
    LEFT JOIN member_app_access song_access ON song_access.member_id = members.id AND song_access.app_code = ?
    ORDER BY members.created_at DESC`).bind(ARCHIVE_APP_CODE, ARCHIVE_SONG_STATS_APP_CODE).all<Record<string, unknown>>();
  return Response.json({ members: result.results.map((row) => ({
    id: String(row.id), name: String(row.name), username: String(row.username), status: String(row.status), accessLevel: String(row.access_level), songStatsAllowed: Number(row.song_stats_allowed) === 1,
  })) });
}

export async function PATCH(request: Request) {
  const admin = await requireArchiveAdminApi();
  if (!admin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const body = await request.json().catch(() => null) as { memberId?: string; accessLevel?: ArchiveAccessLevel; songStatsAllowed?: boolean } | null;
  const hasAccessLevel = body?.accessLevel !== undefined;
  const hasSongStats = body?.songStatsAllowed !== undefined;
  if (!body?.memberId || (!hasAccessLevel && !hasSongStats) || (hasAccessLevel && !LEVELS.has(body.accessLevel!)) || (hasSongStats && typeof body.songStatsAllowed !== "boolean")) {
    return Response.json({ error: "회원과 변경할 권한을 확인해 주세요." }, { status: 400 });
  }
  if (!(await getMember(body.memberId))) {
    return Response.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  }
  if (hasAccessLevel) await setArchiveAccess(body.memberId, body.accessLevel!, admin.email);
  if (hasSongStats) await setArchiveSongStatsAccess(body.memberId, body.songStatsAllowed!, admin.email);
  await recordArchiveAudit({ actor: admin.email, action: "access.update", targetType: "member", targetId: body.memberId, summary: hasSongStats && !hasAccessLevel ? "회원 찬양 통계 권한 변경" : "회원 아카이브 열람 권한 변경", details: { ...(hasAccessLevel ? { accessLevel: body.accessLevel } : {}), ...(hasSongStats ? { songStatsAllowed: String(body.songStatsAllowed) } : {}) } });
  return Response.json({ ok: true });
}
