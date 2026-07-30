import { requireAdminPage } from "../admin-auth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requireAdminPage();

  return (
    <AdminDashboard
      userName={user.fullName ?? "홈페이지 관리자"}
      userEmail={user.email}
      signOutPath="/api/admin/session?return_to=/"
    />
  );
}
