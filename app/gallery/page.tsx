import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";
import GalleryBoard from "./GalleryBoard";
import type { GalleryModalAlbum } from "./GalleryViewer";
import { listContentPosts, listPublicGalleryPosts } from "../../lib/content";
import { getMemberSession } from "../member-auth";

export const metadata: Metadata = {
  alternates: { canonical: "/gallery" },
  title: "갤러리 | 모현제일교회",
  description: "모현제일교회의 예배와 섬김, 교제의 순간을 사진으로 나눕니다.",
};

export const dynamic = "force-dynamic";

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ album?: string; approval?: string }>;
}) {
  const { album: initialAlbumId = "", approval = "" } = await searchParams;
  const [albums, member] = await Promise.all([
    listPublicGalleryPosts(),
    getMemberSession(),
  ]);
  const approved = member?.status === "approved";
  const memberAlbums = approved
    ? await listContentPosts({ type: "gallery" })
    : [];
  const modalAlbums: GalleryModalAlbum[] = memberAlbums.map((album) => ({
    id: album.id,
    title: album.title,
    date: album.date,
    category: album.category,
    content: album.content,
    images: album.images.map(
      (_, index) =>
        `/api/gallery/media?post_id=${encodeURIComponent(album.id)}&image=${index}`,
    ),
  }));

  return (
    <ContentPage
      eyebrow="CHURCH GALLERY"
      title="갤러리"
      description="모현제일교회의 예배와 섬김, 교제의 순간들을 함께 나눕니다."
      current="갤러리"
      heroImage="/assets/hero-flowers-4k.webp"
    >
      <GalleryBoard
        albums={albums}
        memberAccess={approved ? "approved" : member ? "pending" : "guest"}
        modalAlbums={modalAlbums}
        initialAlbumId={initialAlbumId}
        initialApprovalRequired={approval === "required"}
      />
    </ContentPage>
  );
}
