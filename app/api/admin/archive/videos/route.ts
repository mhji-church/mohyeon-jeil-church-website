import { requireAdminApi } from "@/app/admin-auth";
import { listArchiveVideos, upsertArchiveVideo, type ArchiveVideoType } from "@/lib/archive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireAdminApi())) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  return Response.json(await listArchiveVideos({
    type: type === "worship" || type === "attendance" ? (type as ArchiveVideoType) : undefined,
    page: Number(params.get("page") || 1),
    pageSize: 10,
  }));
}

export async function POST(request: Request) {
  if (!(await requireAdminApi())) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
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
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "영상을 저장하지 못했습니다." }, { status: 400 });
  }
}
