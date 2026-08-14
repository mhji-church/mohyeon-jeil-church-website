import { requireAdminApi } from "@/app/admin-auth";
import { ARCHIVE_APP_CODE, setArchiveAccess, type ArchiveAccessLevel } from "@/lib/archive";
import { ensureNetlifySchema, getNetlifyDb } from "@/lib/netlify-db";

const LEVELS = new Set<ArchiveAccessLevel>(["none", "worship", "full"]);

export async function GET() {
  if (!(await requireAdminApi())) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  await ensureNetlifySchema();
  const result = await getNetlifyDb().prepare(`SELECT members.id, members.name, members.username, members.status,
    COALESCE(member_app_access.access_level, 'none') AS access_level
    FROM members LEFT JOIN member_app_access ON member_app_access.member_id = members.id AND member_app_access.app_code = ?
    ORDER BY members.created_at DESC`).bind(ARCHIVE_APP_CODE).all<Record<string, unknown>>();
  return Response.json({ members: result.results.map((row) => ({
    id: String(row.id), name: String(row.name), username: String(row.username), status: String(row.status), accessLevel: String(row.access_level),
  })) });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const body = await request.json().catch(() => null) as { memberId?: string; accessLevel?: ArchiveAccessLevel } | null;
  if (!body?.memberId || !body.accessLevel || !LEVELS.has(body.accessLevel)) {
    return Response.json({ error: "회원과 아카이브 등급을 확인해 주세요." }, { status: 400 });
  }
  await setArchiveAccess(body.memberId, body.accessLevel, admin.email);
  return Response.json({ ok: true });
}
