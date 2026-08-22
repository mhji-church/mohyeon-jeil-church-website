import { redirect } from "next/navigation";
import { getArchiveAdminSession } from "./archive-credential-auth";

export async function requireArchiveAdminPage(returnTo = "/archive/admin") {
  const session = await getArchiveAdminSession();
  if (!session) redirect(`/archive/admin/login?return_to=${encodeURIComponent(returnTo)}`);
  return { user: { displayName: "예배 아카이브 관리자", email: session.username, fullName: "예배 아카이브 관리자" }, authorized: true };
}

export async function requireArchiveAdminApi() {
  const session = await getArchiveAdminSession();
  return session ? { displayName: "예배 아카이브 관리자", email: session.username, fullName: "예배 아카이브 관리자" } : null;
}
