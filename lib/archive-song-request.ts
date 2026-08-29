import type { SongPeriodFilter, SongServiceFilter, SongStatsOptions } from "./archive-songs";

const services = new Set<SongServiceFilter>(["all", "sunday1", "sunday2", "wednesday"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseSongStatsOptions(params: URLSearchParams): SongStatsOptions {
  const serviceValue = params.get("service") as SongServiceFilter | null;
  if (serviceValue && !services.has(serviceValue)) throw new Error("예배 종류를 확인해 주세요.");
  const service = serviceValue || "all";
  const periodValue = params.get("period");
  if (periodValue && !["all", "year", "last12", "custom"].includes(periodValue)) throw new Error("조회 기간을 확인해 주세요.");
  let period: SongPeriodFilter = { mode: "all" };
  if (periodValue === "year") {
    const year = Number(params.get("year"));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("조회 연도를 확인해 주세요.");
    period = { mode: "year", year };
  } else if (periodValue === "last12") period = { mode: "last12" };
  else if (periodValue === "custom") {
    const start = params.get("start") ?? ""; const end = params.get("end") ?? "";
    if ((start && !isValidDate(start)) || (end && !isValidDate(end)) || (start && end && start > end)) throw new Error("조회 기간을 확인해 주세요.");
    period = { mode: "custom", start: start || undefined, end: end || undefined };
  }
  const rawLimit = params.get("limit") ?? "50";
  const limit = rawLimit === "all" ? null : Number(rawLimit);
  if (limit != null && ![10, 20, 50, 100].includes(limit)) throw new Error("표시 개수를 확인해 주세요.");
  return { service, period, limit, search: (params.get("q") ?? "").slice(0, 100) };
}

export function songStatsPeriodLabel(options: SongStatsOptions) {
  if (options.period.mode === "year") return `${options.period.year}년`;
  if (options.period.mode === "last12") return "최근12개월";
  if (options.period.mode === "custom") return `${options.period.start || "시작"}_${options.period.end || "종료"}`;
  return "전체기간";
}

export function songStatsServiceLabel(service: SongServiceFilter) {
  return ({ all: "전체예배", sunday1: "주일1부", sunday2: "주일2부", wednesday: "수요예배" } as const)[service];
}
