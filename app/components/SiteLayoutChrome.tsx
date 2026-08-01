"use client";

import { usePathname } from "next/navigation";
import { SiteFooter, SiteHeader } from "./SiteChrome";

export default function SiteLayoutChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return children;

  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
