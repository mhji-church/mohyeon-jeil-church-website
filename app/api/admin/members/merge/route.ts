import { requireAdminApi } from "../../../../admin-auth";
import {
  getMemberMergePreview,
  mergeMemberAccounts,
  setMemberLoginAliasEnabled,
} from "../../../../../lib/member-merges";
import { apiError } from "../../../../../lib/api-response";

export const dynamic = "force-dynamic";

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  if (!isSameOrigin(request)) {
    return Response.json({ error: "요청 출처를 확인할 수 없습니다." }, { status: 403 });
  }
  const payload = (await request.json().catch(() => null)) as {
    action?: unknown;
    groupId?: unknown;
    fingerprint?: unknown;
    representativeMemberId?: unknown;
    profile?: { name?: unknown; phone?: unknown; birthDate?: unknown; position?: unknown };
    username?: unknown;
    enabled?: unknown;
  } | null;
  const action = typeof payload?.action === "string" ? payload.action : "";
  try {
    if (action === "preview") {
      const groupId = typeof payload?.groupId === "string" ? payload.groupId : "";
      if (!groupId) return Response.json({ error: "중복 그룹을 확인해 주세요." }, { status: 400 });
      const preview = await getMemberMergePreview(groupId);
      if (!preview) return Response.json({ error: "중복 그룹이 변경됐습니다. 목록을 새로고침해 주세요." }, { status: 409 });
      return Response.json({ preview }, { headers: { "cache-control": "private, no-store" } });
    }
    if (action === "merge") {
      const groupId = typeof payload?.groupId === "string" ? payload.groupId : "";
      const fingerprint = typeof payload?.fingerprint === "string" ? payload.fingerprint : "";
      const representativeMemberId = typeof payload?.representativeMemberId === "string"
        ? payload.representativeMemberId
        : "";
      const profile = {
        name: typeof payload?.profile?.name === "string" ? payload.profile.name : "",
        phone: typeof payload?.profile?.phone === "string" ? payload.profile.phone : "",
        birthDate: typeof payload?.profile?.birthDate === "string" ? payload.profile.birthDate : "",
        position: typeof payload?.profile?.position === "string" ? payload.profile.position : "",
      };
      if (!groupId || !fingerprint || !representativeMemberId) {
        return Response.json({ error: "병합 정보를 확인해 주세요." }, { status: 400 });
      }
      const result = await mergeMemberAccounts(
        groupId,
        { fingerprint, representativeMemberId, profile },
        admin.email,
      );
      return Response.json({ ok: true, ...result }, { status: 201, headers: { "cache-control": "private, no-store" } });
    }
    if (action === "alias") {
      const representativeMemberId = typeof payload?.representativeMemberId === "string"
        ? payload.representativeMemberId
        : "";
      const username = typeof payload?.username === "string" ? payload.username : "";
      if (!representativeMemberId || !username || typeof payload?.enabled !== "boolean") {
        return Response.json({ error: "로그인 아이디 정보를 확인해 주세요." }, { status: 400 });
      }
      await setMemberLoginAliasEnabled(
        representativeMemberId,
        username,
        payload.enabled,
        admin.email,
      );
      return Response.json({ ok: true }, { headers: { "cache-control": "private, no-store" } });
    }
    return Response.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
  } catch (error) {
    return apiError("admin.members.merge", error, "계정 병합을 처리하지 못했습니다. 최신 정보를 다시 확인해 주세요.", 409);
  }
}
