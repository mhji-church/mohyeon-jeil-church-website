"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import AnalyticsTracker from "./AnalyticsTracker";

const SiteAuthenticationContext = createContext<boolean | null>(null);

export function useSiteAuthentication() {
  return useContext(SiteAuthenticationContext);
}

export default function SiteLayoutChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/archive")) {
    return (
      <SiteAuthenticationContext.Provider value={authenticated}>
        {children}
        <AnalyticsTracker />
      </SiteAuthenticationContext.Provider>
    );
  }

  return (
    <SiteAuthenticationContext.Provider value={authenticated}>
      <SiteHeader onAuthenticationChange={setAuthenticated} />
      {children}
      <SiteFooter />
      <AnalyticsTracker />
    </SiteAuthenticationContext.Provider>
  );
}
