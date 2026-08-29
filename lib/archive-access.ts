import { getArchiveAdminSession } from "@/app/archive-credential-auth";
import { getMemberSession } from "@/app/member-auth";
import { getArchiveAccess } from "./archive";
import type { ArchiveAccessLevel } from "./archive-shared";

export type ArchiveViewer = { kind: "admin" | "member"; id: string; name: string; level: ArchiveAccessLevel };

export async function getArchiveWorshipViewer(): Promise<ArchiveViewer | null> {
  const admin = await getArchiveAdminSession();
  if (admin) return { kind: "admin", id: admin.username, name: "예배 아카이브 관리자", level: "full" };
  const member = await getMemberSession();
  if (!member || member.forcePasswordChange) return null;
  const level = await getArchiveAccess(member.id);
  if (level !== "worship" && level !== "full") return null;
  return { kind: "member", id: member.id, name: member.name, level };
}

export async function requireArchiveWorshipApi() {
  return getArchiveWorshipViewer();
}
