"use client";

import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader, type HeaderMember } from "./SiteChrome";

export default function SiteLayoutChrome({
  children,
  initialMember,
}: {
  children: React.ReactNode;
  initialMember: HeaderMember | null;
}) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/archive")) return children;

  return (
    <>
      <SiteHeader initialMember={initialMember} />
      {children}
      <SiteFooter />
    </>
  );
}
