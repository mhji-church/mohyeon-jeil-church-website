import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";
import BulletinBoard from "./BulletinBoard";
import { listContentPosts } from "../../lib/content";

export const metadata: Metadata = {
  title: "주보 | 모현제일교회",
  description: "모현제일교회 주보를 날짜별로 확인합니다.",
};

export const dynamic = "force-dynamic";

export default async function BulletinPage() {
  const bulletins = await listContentPosts({ type: "bulletin" });
  return (
    <ContentPage
      eyebrow="WEEKLY BULLETIN"
      title="주보"
      description="예배 순서와 한 주간의 교회 소식을 주보로 확인하세요."
      current="주보"
      heroImage="/assets/hero-worship.webp"
    >
      <BulletinBoard bulletins={bulletins} />
    </ContentPage>
  );
}
