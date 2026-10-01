import { getArchiveAdminSession } from "@/app/archive-credential-auth";
import { getMemberSession } from "@/app/member-auth";
import { redirect } from "next/navigation";
import { getArchiveViewerAccess } from "./archive";
import type { ArchiveAccessLevel } from "./archive-shared";
import { getMemberDisplayPosition } from "./member-display";

export type ArchiveViewer = { kind: "admin" | "member"; id: string; name: string; position?: string; level: ArchiveAccessLevel; songStatsAllowed: boolean };

export async function getArchiveWorshipViewer(): Promise<ArchiveViewer | null> {
  const admin = await getArchiveAdminSession();
  if (admin) return { kind: "admin", id: admin.username, name: "예배 아카이브 관리자", level: "full", songStatsAllowed: true };
  const member = await getMemberSession();
  if (!member || member.status !== "approved" || member.forcePasswordChange) return null;
  const { level, songStatsAllowed } = await getArchiveViewerAccess(member.id);
  if (level !== "worship" && level !== "full") return null;
  return { kind: "member", id: member.id, name: member.name, position: getMemberDisplayPosition(member.position), level, songStatsAllowed };
}

export async function requireArchiveWorshipApi() {
  return getArchiveWorshipViewer();
}

export async function getArchiveSongViewer(): Promise<ArchiveViewer | null> {
  const viewer = await getArchiveWorshipViewer();
  return viewer?.songStatsAllowed ? viewer : null;
}

export async function archiveViewerCanViewSongStats(viewer: ArchiveViewer) {
  return viewer.songStatsAllowed;
}

export async function requireArchiveSongApi() {
  return getArchiveSongViewer();
}

export async function requireArchiveWorshipPage(returnTo: string) {
  const viewer = await getArchiveWorshipViewer();
  if (viewer) return viewer;
  const member = await getMemberSession();
  if (member?.forcePasswordChange) redirect("/member/password");
  if (member) redirect("/archive/access-required");
  redirect(`/member/login?return_to=${encodeURIComponent(returnTo)}`);
}

export async function requireArchiveSongPage() {
  const viewer = await getArchiveSongViewer();
  if (viewer) return viewer;
  const archiveViewer = await getArchiveWorshipViewer();
  if (archiveViewer) redirect("/archive?access=songs-denied");
  const member = await getMemberSession();
  if (member?.forcePasswordChange) redirect("/member/password");
  if (member) redirect("/archive/access-required");
  redirect(`/member/login?return_to=${encodeURIComponent("/archive/songs")}`);
}
