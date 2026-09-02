import { getAdminSession } from "../../credential-auth";
import { getMemberSession } from "../../member-auth";
import { apiError } from "../../../lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [member, admin] = await Promise.all([getMemberSession(), getAdminSession()]);
    return Response.json(
      {
        authenticated: Boolean(member || admin),
        member: member ? { name: member.name, position: member.position } : null,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return apiError("session.read", error, "로그인 상태를 확인하지 못했습니다.", 503);
  }
}
