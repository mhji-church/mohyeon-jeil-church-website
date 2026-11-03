import { beginMemberRecovery, RECOVERY_SECONDS } from "../../../../lib/member-recovery";
import { recoveryHeaders, recoveryInput, recoveryRateLimit, setRecoveryCookie } from "../../../../lib/member-recovery-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await recoveryInput(request);
    if (input.denied) return input.denied;
    const data = input.data!;
    if (typeof data.name !== "string" || data.name.trim().length < 2 || data.name.length > 100 || typeof data.birthDate !== "string" || !/^\d{6}$/.test(data.birthDate) || Object.keys(data).some(key => !["name", "birthDate"].includes(key))) return Response.json({ error: "이름과 생년월일 6자리를 확인해 주세요." }, { status: 400, headers: recoveryHeaders });
    const limited = await recoveryRateLimit(request, "start");
    if (limited) return limited;
    await setRecoveryCookie(await beginMemberRecovery(data.name, data.birthDate), RECOVERY_SECONDS);
    return Response.json({ ok: true, expiresIn: RECOVERY_SECONDS }, { headers: recoveryHeaders });
  } catch { return Response.json({ error: "재설정 시스템에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers: recoveryHeaders }); }
}
