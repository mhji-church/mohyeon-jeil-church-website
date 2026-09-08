import ArchiveAdmin from "@/app/admin/archive/ArchiveAdmin";
import { requireArchiveAdminPage } from "@/app/archive-admin-auth";
export const dynamic = "force-dynamic";
export default async function Page() { const { user } = await requireArchiveAdminPage(); return <ArchiveAdmin userName={user.displayName} userEmail={user.email} signOutPath="/api/admin/session?return_to=/archive" />; }
