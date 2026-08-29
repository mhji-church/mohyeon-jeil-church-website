import ExcelJS from "exceljs";
import { requireArchiveWorshipApi } from "@/lib/archive-access";
import { parseSongStatsOptions, songStatsPeriodLabel, songStatsServiceLabel } from "@/lib/archive-song-request";
import { getArchiveSongExportHistory, getArchiveSongStats } from "@/lib/archive-songs";

function archiveSectionForService(serviceType: string) { return serviceType.startsWith("주일 ") ? "sunday" : "other"; }

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireArchiveWorshipApi())) return Response.json({ error: "예배 영상 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try {
    const options = parseSongStatsOptions(new URL(request.url).searchParams);
    const stats = await getArchiveSongStats(options);
    const history = await getArchiveSongExportHistory(stats.rankings.map((song) => song.id), options);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "모현제일교회 예배 아카이브";
    workbook.created = new Date();
    const rankingSheet = workbook.addWorksheet("찬양 순위", { views: [{ state: "frozen", ySplit: 1 }] });
    rankingSheet.columns = [
      { header: "순위", key: "rank", width: 9 }, { header: "대표 찬양 제목", key: "displayTitle", width: 38 }, { header: "기본 제목", key: "baseTitle", width: 28 }, { header: "대체 제목", key: "aliases", width: 34 },
      { header: "전체 사용 횟수", key: "totalCount", width: 16 }, { header: "주일 1부 사용 횟수", key: "sunday1Count", width: 18 }, { header: "주일 2부 사용 횟수", key: "sunday2Count", width: 18 }, { header: "수요예배 사용 횟수", key: "wednesdayCount", width: 18 }, { header: "최근 사용일", key: "lastUsed", width: 15 },
    ];
    stats.rankings.forEach((song) => rankingSheet.addRow({ ...song, aliases: song.aliases.join(" / "), lastUsed: song.lastUsed ? new Date(`${song.lastUsed}T00:00:00+09:00`) : null }));
    const historySheet = workbook.addWorksheet("사용 이력", { views: [{ state: "frozen", ySplit: 1 }] });
    historySheet.columns = [
      { header: "대표 찬양 제목", key: "displayTitle", width: 38 }, { header: "예배 날짜", key: "date", width: 15 }, { header: "예배 종류", key: "serviceType", width: 20 }, { header: "영상 제목", key: "videoTitle", width: 38 }, { header: "찬양 순서", key: "order", width: 12 }, { header: "예배 아카이브 URL", key: "url", width: 54 },
    ];
    history.forEach((item) => historySheet.addRow({ ...item, date: new Date(`${item.date}T00:00:00+09:00`), url: `https://mhji.kr/archive/${archiveSectionForService(item.serviceType)}?video=${encodeURIComponent(item.videoId)}&q=${encodeURIComponent(item.videoTitle)}` }));
    for (const sheet of [rankingSheet, historySheet]) {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
      sheet.getRow(1).height = 26;
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF343441" } };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) { row.alignment = { vertical: "middle", wrapText: false }; row.height = 22; } });
    }
    rankingSheet.getColumn("lastUsed").numFmt = "yyyy-mm-dd";
    historySheet.getColumn("date").numFmt = "yyyy-mm-dd";
    for (const key of ["rank", "totalCount", "sunday1Count", "sunday2Count", "wednesdayCount"]) rankingSheet.getColumn(key).numFmt = "#,##0";
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
    const filename = `찬양통계_${songStatsServiceLabel(options.service)}_${songStatsPeriodLabel(options)}.xlsx`;
    return new Response(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Excel 파일을 만들지 못했습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
