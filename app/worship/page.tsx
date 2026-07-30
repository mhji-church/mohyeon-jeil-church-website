import type { Metadata } from "next";
import VideoArchivePage, { type ArchiveVideo } from "../components/VideoArchivePage";

export const metadata: Metadata = {
  title: "주일예배 | 모현제일교회",
  description: "모현제일교회 주일예배 전체 영상을 확인할 수 있습니다.",
};

const worshipVideos: ArchiveVideo[] = [
  { videoId: "MaSO7kx9B18", title: "2026년 7월 26일 모현제일교회 주일 2부 예배", date: "2026.07.26", category: "주일 2부 예배" },
  { videoId: "FmXDp2RWlrA", title: "2026년 7월 12일 모현제일교회 주일 2부 예배", date: "2026.07.12", category: "주일 2부 예배" },
  { videoId: "iCdFwgL_3iE", title: "2026년 7월 5일 모현제일교회 주일 2부 예배", date: "2026.07.05", category: "주일 2부 예배" },
  { videoId: "7CZfZ-faRWA", title: "2026년 6월 28일 모현제일교회 주일 2부 예배", date: "2026.06.28", category: "주일 2부 예배" },
  { videoId: "TGQA0-m2HDw", title: "2026년 6월 14일 모현제일교회 주일 2부 예배", date: "2026.06.14", category: "주일 2부 예배" },
  { videoId: "7juuzd6ca8c", title: "2026년 5월 31일 모현제일교회 주일 2부 예배", date: "2026.05.31", category: "주일 2부 예배" },
  { videoId: "295fFtdNzq8", title: "2026년 5월 24일 모현제일교회 주일 2부 예배", date: "2026.05.24", category: "주일 2부 예배" },
  { videoId: "_lo6KT4Prtg", title: "2026년 5월 10일 모현제일교회 주일 2부 예배", date: "2026.05.10", category: "주일 2부 예배" },
  { videoId: "qwWPS3P3hs8", title: "2026년 5월 3일 모현제일교회 주일 2부 예배", date: "2026.05.03", category: "주일 2부 예배" },
  { videoId: "WzrREB11agM", title: "2026년 4월 12일 모현제일교회 주일 2부 예배", date: "2026.04.12", category: "주일 2부 예배" },
  { videoId: "0Ffhgbc3_Mg", title: "2026년 4월 5일 모현제일교회 주일 2부 예배", date: "2026.04.05", category: "주일 2부 예배" },
  { videoId: "5BP-u9i9kz4", title: "2026년 3월 29일 모현제일교회 주일 2부 예배", date: "2026.03.29", category: "주일 2부 예배" },
];

export default function WorshipPage() {
  return (
    <VideoArchivePage
      eyebrow="SUNDAY WORSHIP"
      title="주일예배"
      description="말씀과 찬양으로 하나님을 높이는 주일예배의 자리입니다."
      videos={worshipVideos}
      playlistUrl="https://www.youtube.com/watch?v=MaSO7kx9B18&list=PLgLUeYDaBNJ5h5nMA3PPZrBitScj7sDyz"
      counterpartLabel="설교영상"
      counterpartHref="/sermons"
    />
  );
}
