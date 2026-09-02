import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { getArchiveSettings, getArchiveSystemStatus, saveArchiveSettings } from "@/lib/archive-settings";
import { recordArchiveAudit } from "@/lib/archive-audit";
import { requireArchiveWorshipApi } from "@/lib/archive-access";
import { apiError } from "@/lib/api-response";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const admin = await requireArchiveAdminApi();
    if (!admin && !(await requireArchiveWorshipApi())) {
      return Response.json(
        { error: "예배 아카이브 열람 권한이 필요합니다." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const settings = await getArchiveSettings();
    const payload =
      admin && new URL(request.url).searchParams.get("admin") === "1"
        ? { settings, status: await getArchiveSystemStatus() }
        : { settings: { recentCount: settings.recentCount, defaultSort: settings.defaultSort } };
    return Response.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError("archive.settings.read", error, "아카이브 설정을 불러오지 못했습니다.", 503);
  }
}

export async function PATCH(request: Request) {
  const admin = await requireArchiveAdminApi();
  if (!admin) {
    return Response.json({ error: "아카이브 관리자 권한이 필요합니다." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "설정값을 확인해 주세요." }, { status: 400 });
  }
  try {
    const settings = await saveArchiveSettings(body as Record<string, unknown>, admin.email);
    await recordArchiveAudit({
      actor: admin.email,
      action: "settings.update",
      targetType: "archive_settings",
      summary: "아카이브 운영 설정 변경",
    });
    return Response.json({ ok: true, settings });
  } catch (error) {
    return apiError("archive.settings.update", error, "아카이브 설정을 저장하지 못했습니다.");
  }
}
