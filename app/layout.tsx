import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteLayoutChrome from "./components/SiteLayoutChrome";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mhji.kr"),
  title: "모현제일교회",
  description: "말씀 중심의 예배와 사랑의 섬김이 있는 모현제일교회입니다.",
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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SiteLayoutChrome>{children}</SiteLayoutChrome>
      </body>
    </html>
  );
}
