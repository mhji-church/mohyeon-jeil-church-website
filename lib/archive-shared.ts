export type ArchiveVideoType = "worship" | "attendance";
export type ArchiveAccessLevel = "none" | "worship" | "full";
export type ArchiveAnalysisStatus = "not_started" | "queued" | "processing" | "completed" | "needs_review" | "failed" | "cancelled";
export type ArchiveSongCategory = "opening" | "offertory" | "choir" | "special" | "other";
export type ArchiveAnalysisSource = "caption" | "vision" | "audio" | "manual" | "combined" | "metadata";

export type ArchiveAnalysisSong = {
  id: string;
  order: number;
  title: string;
  category: ArchiveSongCategory;
  hymnNumber: number | null;
  startSeconds: number | null;
  endSeconds: number | null;
  confidence: number;
  source: ArchiveAnalysisSource;
  manuallyEdited: boolean;
  evidence: string;
};

export type ArchiveVideoAnalysis = {
  status: ArchiveAnalysisStatus;
  analysisVersion: string;
  analyzedAt: string | null;
  analysisError: string | null;
  overallConfidence: number | null;
  manualVerifiedAt: string | null;
  manualVerifiedBy: string | null;
  songs: ArchiveAnalysisSong[];
  sermon: {
    title: string | null;
    biblePassage: string | null;
    preacher: string | null;
    startSeconds: number | null;
    confidence: number | null;
    manuallyEdited: boolean;
  };
  representativePrayer: {
    name: string | null;
    role: string | null;
    startSeconds: number | null;
    confidence: number | null;
    manuallyEdited: boolean;
  };
};

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
  analysis?: ArchiveVideoAnalysis | null;
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
