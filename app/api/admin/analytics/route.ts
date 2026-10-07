import { requireAdminApi } from "@/app/admin-auth";
import { canViewAnalyticsForAdmin } from "@/app/credential-auth";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { parseAnalyticsOptions } from "@/lib/analytics-request";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
  const admin = await requireAdminApi();
  if (!canViewAnalyticsForAdmin(admin)) return Response.json({ error: "접속 통계 조회 권한이 필요합니다." }, { status: 403, headers });
  const options = parseAnalyticsOptions(request.url);
  if (!options) return Response.json({ error: "기간 또는 필터를 확인해 주세요." }, { status: 400, headers });
  try { return Response.json(await getAnalyticsReport(options), { headers }); }
  catch (error) { return Response.json({ error: error instanceof Error && error.message === "invalid-range" ? "기간을 확인해 주세요." : "접속 통계를 불러오지 못했습니다." }, { status: error instanceof Error && error.message === "invalid-range" ? 400 : 503, headers }); }
}
