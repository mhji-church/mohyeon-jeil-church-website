import type { Metadata } from "next";
import { archiveViewerCanViewSongStats, requireArchiveWorshipPage } from "@/lib/archive-access";
import ArchivePortal from "./ArchivePortal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "예배 아카이브 | 모현제일교회",
  description: "모현제일교회 예배 영상과 출석 기록을 승인된 회원에게 제공하는 기록 보관 플랫폼입니다.",
};

export default async function ArchivePage() {
  const viewer = await requireArchiveWorshipPage("/archive");
  return <ArchivePortal initialAccess={{ authenticated: true, level: viewer.level, member: { name: viewer.name }, songStatsAllowed: await archiveViewerCanViewSongStats(viewer) }} />;
}
