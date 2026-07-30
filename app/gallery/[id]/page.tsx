import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentPage from "../../components/ContentPage";
import { requireMemberPage } from "../../member-auth";
import { getContentPost } from "../../../lib/content";
import GalleryViewer from "./GalleryViewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "갤러리 앨범 | 모현제일교회",
};

export default async function GalleryAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const returnTo = `/gallery/${encodeURIComponent(id)}#gallery-viewer`;
  await requireMemberPage(returnTo);

  const album = await getContentPost(id);
  if (!album || album.type !== "gallery" || album.status !== "published") notFound();

  const images = album.images.map(
    (_, index) =>
      `/api/gallery/media?post_id=${encodeURIComponent(album.id)}&image=${index}`,
  );

  return (
    <ContentPage
      eyebrow="MEMBERS ONLY GALLERY"
      title={album.title}
      description={`${album.date} · 승인된 교인 회원만 볼 수 있는 사진 앨범입니다.`}
      current="갤러리"
      heroImage="/assets/hero-flowers.webp"
    >
      <GalleryViewer
        title={album.title}
        date={album.date}
        category={album.category}
        content={album.content}
        images={images}
      />
    </ContentPage>
  );
}
