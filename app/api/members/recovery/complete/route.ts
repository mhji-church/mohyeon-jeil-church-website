import { cookies } from "next/headers";
import { clearMemberSessionCookie } from "../../../../member-auth";
import { completeMemberRecovery } from "../../../../../lib/member-recovery";
import { MEMBER_RECOVERY_INVALID } from "../../../../../lib/member-recovery-input";
import { RECOVERY_COOKIE, recoveryHeaders, recoveryInput, recoveryRateLimit, setRecoveryCookie } from "../../../../../lib/member-recovery-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await recoveryInput(request);
    if (input.denied) return input.denied;
    const data = input.data!;
    if (typeof data.password !== "string" || data.password.length < 6 || data.password.length > 72 || data.confirmation !== data.password || Object.keys(data).some(key => !["password", "confirmation"].includes(key))) return Response.json({ error: "새 비밀번호는 6~72자로 입력하고 확인값을 일치시켜 주세요." }, { status: 400, headers: recoveryHeaders });
    const limited = await recoveryRateLimit(request, "complete");
    if (limited) return limited;
    const token = (await cookies()).get(RECOVERY_COOKIE)?.value;
    if (!await completeMemberRecovery(token, data.password)) {
      await setRecoveryCookie("", 0);
      return Response.json({ error: MEMBER_RECOVERY_INVALID }, { status: 400, headers: recoveryHeaders });
    }
    await clearMemberSessionCookie();
    await setRecoveryCookie("", 0);
    return Response.json({ ok: true }, { headers: recoveryHeaders });
  } catch { return Response.json({ error: "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers: recoveryHeaders }); }
}
