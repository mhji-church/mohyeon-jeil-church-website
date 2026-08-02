import { ensureNetlifySchema, getNetlifyDb } from "./netlify-db";

export type YouTubePlaylistType = "worship" | "sermons";

export type YouTubePlaylistVideo = {
  videoId: string;
  title: string;
  date: string;
  category: string;
  thumbnailUrl: string;
  href: string;
};

export const YOUTUBE_PLAYLISTS: Record<YouTubePlaylistType, string> = {
  worship: "PLgLUeYDaBNJ5h5nMA3PPZrBitScj7sDyz",
  sermons: "PLgLUeYDaBNJ47oym-bYAqowVa24vw_t_P",
};

type PlaylistItem = {
  snippet?: {
    title?: string;
    publishedAt?: string;
    resourceId?: { videoId?: string };
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
};

type PlaylistResponse = {
  items?: PlaylistItem[];
  nextPageToken?: string;
  error?: { message?: string };
};

function formatKoreaDate(value: string | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}.${month}.${day}` : "";
}

function thumbnailUrl(item: PlaylistItem, videoId: string) {
  const thumbnails = item.snippet?.thumbnails;
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.standard?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

export async function getYouTubePlaylistVideos(type: YouTubePlaylistType) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");

  const videos: Array<YouTubePlaylistVideo & { publishedAt: string }> = [];
  const seen = new Set<string>();
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      maxResults: "50",
      playlistId: YOUTUBE_PLAYLISTS[type],
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as PlaylistResponse;
    if (!response.ok) {
      throw new Error(data.error?.message || `YouTube API request failed (${response.status})`);
    }

    for (const item of data.items ?? []) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title?.trim();
      if (
        !videoId ||
        !title ||
        title === "Private video" ||
        title === "Deleted video" ||
        seen.has(videoId)
      ) {
        continue;
      }
      seen.add(videoId);
      const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || "";
      videos.push({
        videoId,
        title,
        date: formatKoreaDate(publishedAt),
        category: type === "worship" ? "주일 2부 예배" : "주일예배 설교",
        thumbnailUrl: thumbnailUrl(item, videoId),
        href: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt,
      });
    }

    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return videos
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .map((video) => ({
      videoId: video.videoId,
      title: video.title,
      date: video.date,
      category: video.category,
      thumbnailUrl: video.thumbnailUrl,
      href: video.href,
    }));
}

export async function getCachedYouTubePlaylistVideos(type: YouTubePlaylistType) {
  await ensureNetlifySchema();
  const row = await getNetlifyDb()
    .prepare("SELECT videos_json FROM youtube_playlist_cache WHERE playlist_type = ?")
    .bind(type)
    .first<{ videos_json: string }>();

  if (!row) return null;
  try {
    const videos = JSON.parse(row.videos_json) as YouTubePlaylistVideo[];
    return Array.isArray(videos) && videos.length > 0 ? videos : null;
  } catch {
    return null;
  }
}

export async function syncYouTubePlaylist(type: YouTubePlaylistType) {
  const videos = await getYouTubePlaylistVideos(type);
  await ensureNetlifySchema();
  await getNetlifyDb()
    .prepare(
      `INSERT INTO youtube_playlist_cache (playlist_type, videos_json, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(playlist_type) DO UPDATE SET
         videos_json = excluded.videos_json,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(type, JSON.stringify(videos))
    .run();
  return videos;
}
