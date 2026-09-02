import type { Metadata } from "next";
import VideoArchivePage, { type ArchiveVideo } from "../components/VideoArchivePage";

export const metadata: Metadata = {
  alternates: { canonical: "/sermons" },
  title: "설교영상 | 모현제일교회",
  description: "모현제일교회 주일예배 설교 영상을 확인할 수 있습니다.",
};

const sermonVideos: ArchiveVideo[] = [
  { videoId: "waDExWNnhTs", title: "아프다고 말해도 괜찮아요", date: "2026.07.26", category: "주일예배 설교", detail: "고린도후서 1:8~9 · 이광현 담임목사" },
  { videoId: "R92WDQa-eb8", title: "무덤에서 집으로", date: "2026.07.19", category: "주일예배 설교", detail: "마가복음 5:15~20 · 이광현 담임목사" },
  { videoId: "S27TvW1d_Kg", title: "그가 누구이기에", date: "2026.07.12", category: "주일예배 설교", detail: "누가복음 8:22~25 · 이광현 담임목사" },
  { videoId: "0m_xUy_O4fw", title: "폭풍 가운데 나를 붙드시는 주님", date: "2026.07.05", category: "주일예배 설교", detail: "시편 89:13 · 이광현 담임목사" },
  { videoId: "k0S9fbPaaAs", title: "참교육 3_사랑을 묻다", date: "2026.06.28", category: "주일예배 설교", detail: "요한복음 21:15~19 · 이광현 담임목사" },
  { videoId: "zXd6W9jVCnI", title: "참교육 2_나무에서 내려오게 하다", date: "2026.06.21", category: "주일예배 설교", detail: "누가복음 19:1~7 · 이광현 담임목사" },
  { videoId: "ACsqLJrQcKk", title: "참교육 1_돌을 내려놓게 하다", date: "2026.06.14", category: "주일예배 설교", detail: "요한복음 8:3~7 · 이광현 담임목사" },
  { videoId: "Gg6cGH58850", title: "당신이어서 사랑하십니다", date: "2026.06.07", category: "주일예배 설교", detail: "에베소서 1:4~6 · 이광현 담임목사" },
  { videoId: "L0_gv2gxt1U", title: "우리는 교회 2_하나가 되는 기쁨", date: "2026.05.31", category: "주일예배 설교", detail: "빌립보서 2:1~4 · 이광현 담임목사" },
  { videoId: "LzgvOW0oyr4", title: "원하고 바라고 기도합니다", date: "2026.05.17", category: "주일예배 설교", detail: "마태복음 11:28~30 · 이광현 담임목사" },
  { videoId: "lRDmJdRPRPA", title: "너를 기다린다", date: "2026.05.10", category: "주일예배 설교", detail: "누가복음 15:20~24 · 이광현 담임목사" },
  { videoId: "9H-86NZ5bc0", title: "우리는 교회", date: "2026.05.03", category: "주일예배 설교", detail: "이사야 61:1~3 · 이광현 담임목사" },
  { videoId: "HojTO-q5xk0", title: "하나님께 질문하세요", date: "2026.04.26", category: "주일예배 설교", detail: "하박국 1:2~4 · 이광현 담임목사" },
  { videoId: "ZdwhF5n8XRg", title: "인생은 장애물 달리기", date: "2026.04.12", category: "주일예배 설교", detail: "출애굽기 23:20~22 · 이광현 담임목사" },
];

export default function SermonsPage() {
  return (
    <VideoArchivePage
      eyebrow="SERMON MESSAGE"
      title="설교영상"
      collectionTitle="설교 모음"
      description="일상 가운데 다시 붙드는 생명의 말씀을 전합니다."
      videos={sermonVideos}
      playlistUrl="https://www.youtube.com/watch?v=waDExWNnhTs&list=PLgLUeYDaBNJ47oym-bYAqowVa24vw_t_P"
      counterpartLabel="주일예배"
      counterpartHref="/worship"
      playlistType="sermons"
    />
  );
}
