import { getMemberSession } from "@/app/member-auth";
import { canPlayArchiveVideo, getArchiveAccess, getArchiveVideo } from "@/lib/archive";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMemberSession();
  if (!member) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (member.forcePasswordChange) {
    return Response.json({ error: "비밀번호를 변경한 뒤 영상을 시청할 수 있습니다." }, { status: 403 });
  }
  const { id } = await context.params;
  const video = await getArchiveVideo(id);
  if (!video) return Response.json({ error: "영상을 찾을 수 없습니다." }, { status: 404 });
  const level = await getArchiveAccess(member.id);
  if (!canPlayArchiveVideo(level, video.type)) {
    return Response.json({ error: "이 영상을 열람할 수 있는 아카이브 등급이 필요합니다." }, { status: 403 });
  }
  return Response.json(
    { embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`, note: video.note },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
