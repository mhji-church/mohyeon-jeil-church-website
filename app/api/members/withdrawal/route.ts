import { clearMemberSessionCookie, getMemberSessionWithVersion } from "../../../member-auth";
import { withdrawMember } from "../../../../lib/member-withdrawal";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "요청 경로를 확인해 주세요." }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response(null, { status: 415, headers });
  try {
    const session = await getMemberSessionWithVersion();
    if (!session) return Response.json({ error: "다시 로그인한 후 시도해 주세요." }, { status: 401, headers });
    const reader = request.body?.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let size = 0;
    if (reader) while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1024) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    let payload;
    try { payload = JSON.parse(text); } catch { return Response.json({ error: "입력 내용을 확인해 주세요." }, { status: 400, headers }); }
    if (!payload || typeof payload.password !== "string" || !payload.password || payload.password.length > 72 || payload.confirmed !== true || Object.keys(payload).some(key => !["password", "confirmed"].includes(key))) return Response.json({ error: "현재 비밀번호와 탈퇴 확인을 입력해 주세요." }, { status: 400, headers });
    const forwarded = process.env.NODE_ENV === "development" ? request.headers.get("x-forwarded-for")?.split(",")[0] : null;
    const ip = request.headers.get("x-nf-client-connection-ip") || forwarded || "unknown";
    const result = await withdrawMember({ memberId: session.member.id, sessionVersion: session.version, password: payload.password, ip });
    if (result.status === "limited") return Response.json({ error: "본인 확인 시도가 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429, headers: { ...headers, "Retry-After": String(result.retryAfter) } });
    if (result.status === "incorrect") return Response.json({ error: "현재 비밀번호를 확인해 주세요." }, { status: 401, headers });
    if (result.status === "unauthenticated") return Response.json({ error: "다시 로그인한 후 시도해 주세요." }, { status: 401, headers });
    await clearMemberSessionCookie();
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "탈퇴를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers });
  }
}
