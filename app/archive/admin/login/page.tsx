import { redirect } from "next/navigation";
import { getAdminSession } from "@/app/credential-auth";

export const dynamic = "force-dynamic";
export default async function ArchiveAdminLoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const requested = (await searchParams).return_to;
  const returnTo = requested?.startsWith("/archive/admin") && !requested.startsWith("//") ? requested : "/archive/admin";
  const session = await getAdminSession();
  if (session?.canManageArchive) redirect(returnTo);
  redirect(`/admin/login?return_to=${encodeURIComponent(returnTo)}`);
}
