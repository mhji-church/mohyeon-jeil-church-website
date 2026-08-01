import { notFound, redirect } from "next/navigation";
import { requireMemberPage } from "../../member-auth";
import { getContentPost } from "../../../lib/content";

export const dynamic = "force-dynamic";

export default async function GalleryAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const returnTo = `/gallery?album=${encodeURIComponent(id)}`;
  await requireMemberPage(returnTo);

  const album = await getContentPost(id);
  if (!album || album.type !== "gallery" || album.status !== "published") notFound();

  redirect(`/gallery?album=${encodeURIComponent(album.id)}`);
}
