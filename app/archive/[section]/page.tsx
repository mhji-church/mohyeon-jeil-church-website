import { notFound } from "next/navigation";
import { archiveViewerCanViewSongStats, requireArchiveWorshipPage } from "@/lib/archive-access";
import ArchivePortal from "../ArchivePortal";

export const dynamic = "force-dynamic";

const archiveSections = new Set(["sunday", "other", "attendance"]);

export default async function ArchiveSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!archiveSections.has(section)) notFound();
  const returnTo = `/archive/${section}`;
  const viewer = await requireArchiveWorshipPage(returnTo);
  return <ArchivePortal initialAccess={{ authenticated: true, level: viewer.level, member: { name: viewer.name }, songStatsAllowed: await archiveViewerCanViewSongStats(viewer) }} />;
}
