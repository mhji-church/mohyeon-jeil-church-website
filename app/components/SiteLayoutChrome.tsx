"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext } from "react";
import { SiteFooter, SiteHeader, type HeaderMember } from "./SiteChrome";

const SiteAuthenticationContext = createContext(false);

export function useSiteAuthentication() {
  return useContext(SiteAuthenticationContext);
}

export default function SiteLayoutChrome({
  children,
  initialMember,
  initiallyAuthenticated,
}: {
  children: React.ReactNode;
  initialMember: HeaderMember | null;
  initiallyAuthenticated: boolean;
}) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/archive")) {
    return (
      <SiteAuthenticationContext.Provider value={initiallyAuthenticated}>
        {children}
      </SiteAuthenticationContext.Provider>
    );
  }

  return (
    <SiteAuthenticationContext.Provider value={initiallyAuthenticated}>
      <SiteHeader initialMember={initialMember} />
      {children}
      <SiteFooter />
    </SiteAuthenticationContext.Provider>
  );
}
