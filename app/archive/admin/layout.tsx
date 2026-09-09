import type { Metadata } from "next";
import { requireArchiveAdminPage } from "@/app/archive-admin-auth";
import { ArchiveAdminPermissionProvider } from "@/app/archive/ArchiveShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ArchiveAdminLayout({ children }: { children: React.ReactNode }) {
  const { canManageWebsite } = await requireArchiveAdminPage();
  return <ArchiveAdminPermissionProvider canManageWebsite={canManageWebsite}>{children}</ArchiveAdminPermissionProvider>;
}
