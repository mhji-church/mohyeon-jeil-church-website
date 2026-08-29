import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/app/member-auth";
import { getArchiveWorshipViewer } from "@/lib/archive-access";
import SongStats from "./SongStats";

export const metadata: Metadata = { title: "찬양 통계 | 모현제일교회 예배 아카이브", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ArchiveSongStatsPage() {
  const viewer = await getArchiveWorshipViewer();
  if (!viewer) {
    const member = await getMemberSession();
    if (member) redirect("/archive?access=denied");
    redirect(`/member/login?return_to=${encodeURIComponent("/archive/songs")}`);
  }
  return <SongStats viewerName={viewer.name} viewerKind={viewer.kind} />;
}
