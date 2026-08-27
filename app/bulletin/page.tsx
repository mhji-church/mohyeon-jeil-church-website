import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";
import BulletinBoard from "./BulletinBoard";
import { listPublicContentPostPage } from "../../lib/content";

export const metadata: Metadata = {
  title: "주보 | 모현제일교회",
  description: "모현제일교회 주보를 날짜별로 확인합니다.",
};

export const dynamic = "force-dynamic";

export default async function BulletinPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const requestedPage = (await searchParams).page;
  const page = await listPublicContentPostPage({
    type: "bulletin",
    page: typeof requestedPage === "string" ? requestedPage : undefined,
  });
  return (
    <ContentPage
      eyebrow="WEEKLY BULLETIN"
      title="주보"
      description="예배 순서와 한 주간의 교회 소식을 주보로 확인하세요."
      heroImage="/assets/hero-bulletin.webp"
      current="주보"
    >
      <BulletinBoard {...page} />
    </ContentPage>
  );
}
