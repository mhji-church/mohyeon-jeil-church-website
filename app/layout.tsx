import type { Metadata } from "next";
import SiteLayoutChrome from "./components/SiteLayoutChrome";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mhji.kr"),
  title: "모현제일교회",
  description: "말씀 중심의 예배와 사랑의 섬김이 있는 모현제일교회입니다.",
  alternates: { canonical: "/" },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="/assets/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
      </head>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Church",
              name: "모현제일교회",
              url: "https://mhji.kr",
              telephone: "031-333-5420",
              address: {
                "@type": "PostalAddress",
                streetAddress: "백옥대로 2318-22",
                addressLocality: "처인구 모현읍",
                addressRegion: "경기도 용인시",
                addressCountry: "KR",
              },
            }).replace(/</g, "\\u003c"),
          }}
        />
        <SiteLayoutChrome>
          {children}
        </SiteLayoutChrome>
      </body>
    </html>
  );
}
