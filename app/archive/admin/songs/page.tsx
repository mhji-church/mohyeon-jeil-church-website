import { requireArchiveAdminPage } from "@/app/archive-admin-auth";
import SongManager from "./SongManager";
export const dynamic = "force-dynamic";
export default async function Page() { const { user } = await requireArchiveAdminPage("/archive/admin/songs"); return <SongManager userName={user.displayName} />; }
