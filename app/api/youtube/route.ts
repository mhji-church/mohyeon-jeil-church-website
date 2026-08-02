import { NextRequest, NextResponse } from "next/server";
import {
  getCachedYouTubePlaylistVideos,
  syncYouTubePlaylist,
  type YouTubePlaylistType,
} from "../../../lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  if (type !== "worship" && type !== "sermons") {
    return NextResponse.json({ error: "올바르지 않은 재생목록입니다." }, { status: 400 });
  }

  try {
    const playlistType = type as YouTubePlaylistType;
    const videos =
      (await getCachedYouTubePlaylistVideos(playlistType)) ??
      (await syncYouTubePlaylist(playlistType));
    return NextResponse.json(
      { videos },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
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
