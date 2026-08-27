import type { Metadata } from "next";
import SiteLayoutChrome from "./components/SiteLayoutChrome";
import { getMemberSession } from "./member-auth";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mhji.kr"),
  title: "모현제일교회",
  description: "말씀 중심의 예배와 사랑의 섬김이 있는 모현제일교회입니다.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "모현제일교회",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://mhji.kr",
    siteName: "모현제일교회",
    title: "모현제일교회",
    description: "말씀 중심의 예배와 사랑의 섬김이 있는 모현제일교회입니다.",
    images: [
      {
        url: "/assets/mhji-social-preview.png",
        width: 1200,
        height: 630,
        alt: "모현제일교회",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "모현제일교회",
    description: "말씀 중심의 예배와 사랑의 섬김이 있는 모현제일교회입니다.",
    images: ["/assets/mhji-social-preview.png"],
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/assets/favicon.png",
    shortcut: "/assets/favicon.png",
    apple: "/assets/icon-192.png?v=2",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const member = await getMemberSession();
  const initialMember = member
    ? { name: member.name, position: member.position }
    : null;

  return (
    <html lang="ko">
      <body className="antialiased">
        <SiteLayoutChrome initialMember={initialMember}>{children}</SiteLayoutChrome>
      </body>
    </html>
  );
}
