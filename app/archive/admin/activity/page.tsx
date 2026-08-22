import { requireArchiveAdminPage } from "@/app/archive-admin-auth";
import ActivityAdmin from "@/app/admin/activity/ActivityAdmin";
export const dynamic = "force-dynamic";
export default async function Page() { const { user } = await requireArchiveAdminPage("/archive/admin/activity"); return <ActivityAdmin userEmail={user.email} />; }
