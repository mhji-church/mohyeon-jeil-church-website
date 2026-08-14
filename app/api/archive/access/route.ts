import { getMemberSession } from "@/app/member-auth";
import { getArchiveAccess } from "@/lib/archive";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getMemberSession();
  if (!member) return Response.json({ authenticated: false, level: "none" }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { authenticated: true, member: { name: member.name }, level: await getArchiveAccess(member.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
