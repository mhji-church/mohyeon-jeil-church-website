import { syncYouTubePlaylist } from "../../lib/youtube";

export default async function handler() {
  const videos = await syncYouTubePlaylist("worship");
  return new Response(
    JSON.stringify({ playlist: "worship", count: videos.length }),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
}

export const config = {
  // 주일 오후 12시 35분(KST) = 주일 오전 3시 35분(UTC)
  schedule: "35 3 * * 0",
};
