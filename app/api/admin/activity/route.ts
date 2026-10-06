import { requireAdminApi } from "@/app/admin-auth";
import { listAdminAudit } from "@/lib/admin-audit";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin?.canManageArchive) return Response.json({ error: "활동 기록 조회 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await listAdminAudit({
      page: Number(params.get("page") || 1),
      pageSize: 20,
      query: params.get("q") ?? "",
      action: params.get("action") ?? "",
      group: params.get("group") ?? "",
    }), { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return apiError("admin.activity.list", error, "활동 기록을 불러오지 못했습니다.", 503);
  }
}
