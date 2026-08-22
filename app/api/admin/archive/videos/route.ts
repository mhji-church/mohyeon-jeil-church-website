import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { listArchiveVideos, upsertArchiveVideo, type ArchiveVideoType } from "@/lib/archive";
import { recordArchiveAudit } from "@/lib/archive-audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireArchiveAdminApi())) return Response.json({ error: "아카이브 관리자 권한이 필요합니다." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const serviceGroup = params.get("serviceGroup");
  return Response.json(await listArchiveVideos({
    type: type === "worship" || type === "attendance" ? (type as ArchiveVideoType) : undefined,
    serviceGroup: serviceGroup === "sunday" || serviceGroup === "other" ? serviceGroup : undefined,
    search: params.get("search") ?? undefined,
    sort: params.get("sort") === "oldest" ? "oldest" : "newest",
    page: Number(params.get("page") || 1),
    pageSize: 10,
  }));
}

export async function POST(request: Request) {
  const admin = await requireArchiveAdminApi();
  if (!admin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "등록 정보를 확인해 주세요." }, { status: 400 });
  try {
    const id = typeof body.id === "string" && body.id ? body.id : crypto.randomUUID();
    if (body.type !== "worship" && body.type !== "attendance") {
      return Response.json({ error: "영상 분류를 확인해 주세요." }, { status: 400 });
    }
    await upsertArchiveVideo({
      id,
      type: body.type,
      date: String(body.date ?? ""),
      serviceType: String(body.serviceType ?? ""),
      title: String(body.title ?? ""),
      preacher: String(body.preacher ?? ""),
      youtubeId: "",
      youtubeUrl: String(body.youtubeUrl ?? ""),
      thumbnailUrl: String(body.thumbnailUrl ?? ""),
      durationSeconds: body.durationSeconds == null || body.durationSeconds === "" ? null : Number(body.durationSeconds),
      note: String(body.note ?? ""),
    });
    await recordArchiveAudit({ actor: admin.email, action: body.id ? "video.update" : "video.create", targetType: "archive_video", targetId: id, summary: `${String(body.title ?? "영상")} ${body.id ? "수정" : "등록"}`, details: { type: String(body.type), serviceType: String(body.serviceType ?? "") } });
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "영상을 저장하지 못했습니다." }, { status: 400 });
  }
}
