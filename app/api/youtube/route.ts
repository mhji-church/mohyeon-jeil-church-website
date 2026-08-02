import { NextRequest, NextResponse } from "next/server";
import {
  getYouTubePlaylistVideos,
  type YouTubePlaylistType,
} from "../../../lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (type !== "worship" && type !== "sermons") {
    return NextResponse.json({ error: "올바르지 않은 재생목록입니다." }, { status: 400 });
  }

  try {
    const videos = await getYouTubePlaylistVideos(type as YouTubePlaylistType);
    return NextResponse.json(
      { videos },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    console.error("Failed to update the YouTube playlist", error);
    return NextResponse.json(
      { error: "유튜브 영상 목록을 불러오지 못했습니다." },
      { status: 502 },
    );
  }
}
