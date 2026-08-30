import { notFound, redirect } from "next/navigation";
import { getMemberSession } from "../../member-auth";
import { getContentPost } from "../../../lib/content";

export const dynamic = "force-dynamic";

export default async function GalleryAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const returnTo = `/gallery?album=${encodeURIComponent(id)}`;
  const member = await getMemberSession();
  if (!member) redirect(`/member/login?return_to=${encodeURIComponent(returnTo)}`);
  if (member.status !== "approved") redirect("/gallery?approval=required");

  const album = await getContentPost(id);
  if (!album || album.type !== "gallery" || album.status !== "published") notFound();

  redirect(`/gallery?album=${encodeURIComponent(album.id)}`);
}
