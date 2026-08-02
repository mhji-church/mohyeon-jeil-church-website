import { syncYouTubePlaylist } from "../../lib/youtube";

export default async function handler() {
  const videos = await syncYouTubePlaylist("sermons");
  return new Response(
    JSON.stringify({ playlist: "sermons", count: videos.length }),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}

export const config = {
  // 월요일 오전 8시 10분(KST) = 일요일 오후 11시 10분(UTC)
  schedule: "10 23 * * 0",
};
