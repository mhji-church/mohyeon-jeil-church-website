import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { extractYouTubeId } from "@/lib/archive";

function parseIsoDuration(value: string) {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function classifyTitle(title: string) {
  const dateMatch = title.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : "";
  const attendance = /출석\s*(교인|기록|현황)/.test(title);
  let serviceType = "특별예배";
  if (/주일\s*1부/.test(title)) serviceType = attendance ? "주일예배" : "주일 1부 예배";
  else if (/주일\s*2부/.test(title)) serviceType = attendance ? "주일예배" : "주일 2부 예배";
  else if (/주일예배|주일\s*예배/.test(title)) serviceType = "주일예배";
  else if (/수요/.test(title)) serviceType = "수요예배";
  const special = /결혼|고난주간|신년|특별|새벽\s*기도회/.test(title);
  if (special) serviceType = "특별예배";
  return { date, type: attendance ? "attendance" : "worship", serviceType };
}

export async function GET(request: Request) {
  if (!(await requireArchiveAdminApi())) return Response.json({ error: "아카이브 관리자 권한이 필요합니다." }, { status: 403 });
  const url = new URL(request.url).searchParams.get("url") ?? "";
  const videoId = extractYouTubeId(url);
  if (!videoId) return Response.json({ error: "올바른 유튜브 URL을 입력해 주세요." }, { status: 400 });
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Netlify에 YOUTUBE_API_KEY 설정이 필요합니다." }, { status: 503 });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  if (!response.ok) return Response.json({ error: "유튜브 영상 정보를 확인하지 못했습니다." }, { status: 502 });
  const data = await response.json() as { items?: Array<{ snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> }; contentDetails?: { duration?: string } }> };
  const item = data.items?.[0];
  if (!item?.snippet?.title) return Response.json({ error: "유튜브 영상을 찾을 수 없습니다." }, { status: 404 });
  const title = item.snippet.title;
  const classified = classifyTitle(title);
  return Response.json({
    videoId,
    title,
    ...classified,
    durationSeconds: item.contentDetails?.duration ? parseIsoDuration(item.contentDetails.duration) : null,
    thumbnailUrl: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  });
}
