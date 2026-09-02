import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { listArchiveAudit } from "@/lib/archive-audit";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireArchiveAdminApi())) {
    return Response.json({ error: "아카이브 관리자 권한이 필요합니다." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await listArchiveAudit({
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("pageSize") || 20),
      query: params.get("q") ?? "",
    }), { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return apiError("archive.activity.list", error, "활동 기록을 불러오지 못했습니다.", 503);
  }
}
