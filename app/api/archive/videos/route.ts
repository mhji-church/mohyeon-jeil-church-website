import { listArchiveVideos, type ArchiveVideoType } from "@/lib/archive";
import { requireArchiveWorshipApi } from "@/lib/archive-access";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireArchiveWorshipApi())) return Response.json({ error: "예배 아카이브 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const group = params.get("group");
  const sort = params.get("sort");
  try {
    const result = await listArchiveVideos({
      type: type === "worship" || type === "attendance" ? (type as ArchiveVideoType) : undefined,
      serviceGroup: group === "sunday" || group === "other" ? group : undefined,
      search: params.get("q") ?? "",
      year: params.get("year") ?? "",
      month: params.get("month") ?? "",
      sort: sort === "oldest" ? "oldest" : "newest",
      page: Number(params.get("page") || 1),
      pageSize: Number(params.get("pageSize") || 8),
      analysis: "public",
    });
    const videos = result.videos.map((video) => ({
      id: video.id,
      type: video.type,
      date: video.date,
      serviceType: video.serviceType,
      title: video.title,
      preacher: video.preacher,
      durationSeconds: video.durationSeconds,
      note: "",
      createdAt: "",
      updatedAt: "",
      analysis: video.analysis ?? null,
    }));
    return Response.json({ ...result, videos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError("archive.videos.list", error, "예배 기록을 불러오지 못했습니다.", 503);
  }
}
