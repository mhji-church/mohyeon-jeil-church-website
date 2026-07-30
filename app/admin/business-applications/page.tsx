import { requireAdminPage } from "../../admin-auth";
import AdminBusinessApplications from "./AdminBusinessApplications";

export const dynamic = "force-dynamic";

export default async function AdminBusinessApplicationsPage() {
  const { user } = await requireAdminPage();
  return (
    <AdminBusinessApplications
      userName={user.fullName ?? "홈페이지 관리자"}
      userEmail={user.email}
      signOutPath="/api/admin/session?return_to=/"
    />
  );
}
