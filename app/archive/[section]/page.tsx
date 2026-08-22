import { notFound } from "next/navigation";
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
  return <ArchivePortal />;
}
