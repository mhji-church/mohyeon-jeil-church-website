import { requireAdminPage } from "@/app/admin-auth";
import ArchiveAdmin from "./ArchiveAdmin";

export const dynamic = "force-dynamic";

export default async function ArchiveAdminPage() {
  const { user } = await requireAdminPage();
  return <ArchiveAdmin userName={user.fullName ?? "홈페이지 관리자"} userEmail={user.email} signOutPath="/api/admin/session?return_to=/" />;
}
