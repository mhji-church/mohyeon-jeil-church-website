import { serveArchiveThumbnail } from "@/lib/archive-thumbnail";
import { requireArchiveWorshipApi } from "@/lib/archive-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return Response.json({ error: "예배 아카이브 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const viewer = await requireArchiveWorshipApi();
  if (!viewer) return Response.json({ error: "예배 아카이브 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await context.params;
  return serveArchiveThumbnail(id, cookieHeader, viewer.level);
}
