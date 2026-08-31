import { getMemberSession } from "@/app/member-auth";
import { getArchiveAccess, getArchiveSongStatsAccess } from "@/lib/archive";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getMemberSession();
  if (!member) return Response.json({ authenticated: false, level: "none", songStatsAllowed: false }, { headers: { "Cache-Control": "no-store" } });
  if (member.status !== "approved") {
    return Response.json(
      { authenticated: true, approvalPending: true, member: { name: member.name }, level: "none", songStatsAllowed: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const level = await getArchiveAccess(member.id);
  return Response.json(
    { authenticated: true, approvalPending: false, member: { name: member.name }, level, songStatsAllowed: await getArchiveSongStatsAccess(member.id, level) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
