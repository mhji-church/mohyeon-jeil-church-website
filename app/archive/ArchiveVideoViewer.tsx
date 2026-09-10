"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { formatArchiveDuration, type ArchiveVideo } from "@/lib/archive-shared";

export type ArchivePlayingVideo = { video: ArchiveVideo; embedUrl: string };

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function formatDate(value: string) { return value.replaceAll("-", "."); }
function publicSongs(video: ArchiveVideo) { return video.analysis?.songs.filter((song) => song.category !== "offertory" && song.title.trim()) ?? []; }
function sermonTitleStyle(title: string) {
  const length = [...title].length;
  if (length >= 34) return { fontSize: "12px", letterSpacing: "-0.075em" };
  if (length >= 28) return { fontSize: "13px", letterSpacing: "-0.06em" };
  if (length >= 22) return { fontSize: "14px", letterSpacing: "-0.045em" };
  if (length >= 17) return { fontSize: "15px", letterSpacing: "-0.025em" };
  return { fontSize: "16px", letterSpacing: "normal" };
}

export default function ArchiveVideoViewer({
  playing,
  onClose,
  returnFocusRef,
  lockBodyScroll = true,
  layered = false,
}: {
  playing: ArchivePlayingVideo;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  lockBodyScroll?: boolean;
  layered?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const returnFocusElement = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButton.current?.focus(), 0);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", key);
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;
      window.setTimeout(() => returnFocusElement?.focus({ preventScroll: true }), 0);
    };
  }, [lockBodyScroll, playing.video.id, returnFocusRef]);

  return <div className={`viewer-backdrop${layered ? " is-layered" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="viewer-modal" ref={panelRef} tabIndex={-1}>
      <div className="viewer-head"><div><span>{formatDate(playing.video.date)} · {playing.video.serviceType}</span><h2 id={titleId}>{playing.video.title}</h2></div><button ref={closeButton} onClick={onClose} aria-label="닫기" type="button">×</button></div>
      <div className="viewer-player"><iframe key={playing.video.id} src={playing.embedUrl} title={playing.video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
      <dl className="viewer-details"><div><dt>예배 날짜</dt><dd>{formatDate(playing.video.date)}</dd></div><div><dt>예배 종류</dt><dd>{playing.video.serviceType}</dd></div><div><dt>설교자</dt><dd>{playing.video.analysis?.sermon.preacher || playing.video.preacher || "모현제일교회"}</dd></div><div><dt>영상 길이</dt><dd>{formatArchiveDuration(playing.video.durationSeconds)}</dd></div><div><dt>비고</dt><dd>{playing.video.note || "기록 없음"}</dd></div></dl>
      {playing.video.analysis && <section className="viewer-analysis"><div><h3>찬양</h3>{publicSongs(playing.video).length ? <ol>{publicSongs(playing.video).map((song, index) => <li key={song.id}><b className="viewer-song-number">{index + 1}.</b><span>{song.title}</span></li>)}</ol> : <p>등록된 찬양 정보가 없습니다.</p>}</div><div><h3>말씀</h3><p><strong>설교 제목</strong><span className="viewer-sermon-title" style={sermonTitleStyle(playing.video.analysis.sermon.title || "등록된 정보 없음")}>{playing.video.analysis.sermon.title || "등록된 정보 없음"}</span></p><p><strong>본문</strong>{playing.video.analysis.sermon.biblePassage || "등록된 정보 없음"}</p></div><div><h3>대표기도</h3>{playing.video.analysis.representativePrayer.name ? <p className="viewer-prayer"><span>{playing.video.analysis.representativePrayer.name}</span>{playing.video.analysis.representativePrayer.role && <span>{playing.video.analysis.representativePrayer.role}</span>}</p> : <p className="viewer-prayer">등록된 정보 없음</p>}</div></section>}
      <p className="sharing-notice">유튜브 일부공개 영상은 주소가 외부에 공유되면 사이트 밖에서도 재생될 수 있습니다.</p>
    </div>
  </div>;
}
