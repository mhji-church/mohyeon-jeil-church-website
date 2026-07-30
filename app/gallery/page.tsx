import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";
import GalleryBoard from "./GalleryBoard";
import { listPublicGalleryPosts } from "../../lib/content";
import { getMemberSession } from "../member-auth";

export const metadata: Metadata = {
  title: "갤러리 | 모현제일교회",
  description: "모현제일교회의 예배와 섬김, 교제의 순간을 사진으로 나눕니다.",
};

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [albums, member] = await Promise.all([
    listPublicGalleryPosts(),
    getMemberSession(),
  ]);

  return (
    <ContentPage
      eyebrow="CHURCH GALLERY"
      title="갤러리"
      description="모현제일교회의 예배와 섬김, 교제의 순간들을 함께 나눕니다."
      current="갤러리"
      heroImage="/assets/hero-flowers.webp"
    >
      <GalleryBoard albums={albums} isMember={Boolean(member)} />
    </ContentPage>
  );
}
