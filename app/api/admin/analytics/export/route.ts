import { requireAdminApi } from "@/app/admin-auth";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { parseAnalyticsOptions } from "@/lib/analytics-request";

function safeCell(value: unknown) {
  let text = String(value ?? "").replace(/[\r\n\t]/g, " ");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
  const admin = await requireAdminApi();
  if (!admin?.canViewAnalytics || admin.accountId !== "archive-credential") return Response.json({ error: "접속 통계 다운로드 권한이 필요합니다." }, { status: 403, headers });
  const options = parseAnalyticsOptions(request.url);
  if (!options) return Response.json({ error: "기간 또는 필터를 확인해 주세요." }, { status: 400, headers });
  try {
    const report = await getAnalyticsReport(options);
    const lines: unknown[][] = [
      ["접속 통계", `${report.range.start} ~ ${report.range.end}`],
      ["수집 시작일", report.collectionDay],
      ["상세 보관 시작일", report.coverageStart],
      ["지표", "값", "비고"],
      ["방문자", report.metrics.visitors, report.metrics.visitorsEstimated ? "추정" : "선택 기간 고유 익명 방문자"],
      ["방문 횟수", report.metrics.visits], ["페이지 조회수", report.metrics.pageviews],
      ["신규 방문자", report.metrics.newVisitors, report.metrics.visitorsEstimated ? "추정" : ""],
      ["재방문자", report.metrics.returningVisitors, report.metrics.visitorsEstimated ? "추정" : ""],
      ["방문당 페이지 조회수", report.metrics.pagesPerVisit], ["평균 측정 참여 시간(초)", report.metrics.averageEngagementSeconds],
      [], ["추이", "방문자", "방문 횟수", "조회수", "추정 여부"],
      ...report.trend.map((item) => [item.bucket, item.visitors, item.visits, item.pageviews, item.estimated ? "추정" : ""]),
      [], ["인기 페이지", "조회수", "방문자"], ...report.pages.map((item) => [item.label, item.pageviews, item.visitors]),
      [], ["유입 유형", "방문자", "방문 횟수"], ...report.sources.map((item) => [item.label, item.visitors, item.visits]),
      [], ["국가", "방문자", "방문 횟수"], ...report.countries.map((item) => [item.label, item.visitors, item.visits]),
      [], ["기기", "방문자", "방문 횟수"], ...report.devices.map((item) => [item.label, item.visitors, item.visits]),
      [], ["주요 행동", "콘텐츠", "횟수"], ...report.actions.map((item) => [item.kind, item.title || item.contentId || item.contentType, item.total]),
    ];
    const csv = `\uFEFF${lines.map((line) => line.map(safeCell).join(",")).join("\r\n")}`;
    const filename = `mhji-analytics-${report.range.start}-${report.range.end}.csv`;
    return new Response(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === "invalid-range" ? "기간을 확인해 주세요." : "접속 통계를 다운로드하지 못했습니다." }, { status: error instanceof Error && error.message === "invalid-range" ? 400 : 503, headers });
  }
}
