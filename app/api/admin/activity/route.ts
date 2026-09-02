import { requireAdminApi } from "@/app/admin-auth";
import { listAdminAudit } from "@/lib/admin-audit";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await requireAdminApi())) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await listAdminAudit({
      page: Number(params.get("page") || 1),
      pageSize: 20,
      query: params.get("q") ?? "",
      action: params.get("action") ?? "",
    }), { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return apiError("admin.activity.list", error, "활동 기록을 불러오지 못했습니다.", 503);
  }
}
