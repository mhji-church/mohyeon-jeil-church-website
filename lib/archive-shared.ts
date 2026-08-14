export type ArchiveVideoType = "worship" | "attendance";
export type ArchiveAccessLevel = "none" | "worship" | "full";

export type ArchiveVideo = {
  id: string;
  type: ArchiveVideoType;
  date: string;
  serviceType: string;
  title: string;
  preacher: string;
  durationSeconds: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ArchiveVideoAdmin = ArchiveVideo & {
  youtubeId: string;
  youtubeUrl: string;
  thumbnailUrl: string;
};

export function formatArchiveDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "길이 확인 중";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
