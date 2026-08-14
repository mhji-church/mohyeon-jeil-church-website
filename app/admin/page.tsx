import { requireAdminPage } from "../admin-auth";
import type { ContentType } from "../../lib/content";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const { user } = await requireAdminPage();
  const params = await searchParams;
  const requestedSection = Array.isArray(params?.section)
    ? params.section[0]
    : params?.section;
  const initialType: ContentType = ["bulletin", "news", "gallery", "business"].includes(
    requestedSection ?? "",
  )
    ? (requestedSection as ContentType)
    : "bulletin";

  return (
    <AdminDashboard
      userName={user.fullName ?? "홈페이지 관리자"}
      userEmail={user.email}
      signOutPath="/api/admin/session?return_to=/"
      initialType={initialType}
    />
  );
}
