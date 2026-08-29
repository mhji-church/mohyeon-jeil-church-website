export type YouTubeDescriptionFields = {
  songs?: string[];
  sermonTitle?: string;
  biblePassage?: string;
  prayerName?: string;
  prayerRole?: string;
};

export type ParsedSongTitle = {
  displayTitle: string;
  baseTitle: string;
  normalizedBaseTitle: string;
  aliases: string[];
  normalizedAliases: string[];
};

export function normalizeSongTitle(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .replace(/\s+\(/gu, "(")
    .replace(/\(\s+/gu, "(")
    .replace(/\s+\)/gu, ")")
    .toLocaleLowerCase("ko-KR");
}

export function parseSongTitle(value: string): ParsedSongTitle | null {
  const displayTitle = value.normalize("NFKC").trim().replace(/\s+/gu, " ").replace(/\s+\(/gu, "(");
  if (!displayTitle) return null;
  const match = displayTitle.match(/^(.+?)\s*\(([^()]*)\)\s*$/u);
  const baseTitle = (match?.[1] ?? displayTitle).trim();
  const alias = match?.[2]?.trim() ?? "";
  return {
    displayTitle: alias ? `${baseTitle}(${alias})` : baseTitle,
    baseTitle,
    normalizedBaseTitle: normalizeSongTitle(baseTitle),
    aliases: alias ? [alias] : [],
    normalizedAliases: alias ? [normalizeSongTitle(alias)] : [],
  };
}

export function dedupeSongTitles(values: string[]) {
  const parsed = values.map(parseSongTitle).filter((song): song is ParsedSongTitle => Boolean(song));
  const groups: ParsedSongTitle[][] = [];
  for (const song of parsed) {
    const keys = new Set([song.normalizedBaseTitle, ...song.normalizedAliases, normalizeSongTitle(song.displayTitle)]);
    const matches = groups.filter((group) => group.some((item) => [item.normalizedBaseTitle, ...item.normalizedAliases, normalizeSongTitle(item.displayTitle)].some((key) => keys.has(key))));
    if (!matches.length) { groups.push([song]); continue; }
    const target = matches[0];
    target.push(song);
    for (const extra of matches.slice(1)) {
      target.push(...extra);
      groups.splice(groups.indexOf(extra), 1);
    }
  }
  return groups.map((group) => {
    const richest = [...group].sort((a, b) => b.aliases.length - a.aliases.length)[0];
    const aliases = [...new Set(group.flatMap((song) => [song.baseTitle, ...song.aliases]).filter((title) => normalizeSongTitle(title) !== richest.normalizedBaseTitle))];
    return { ...richest, aliases, normalizedAliases: aliases.map(normalizeSongTitle) };
  });
}

const PRAYER_ROLES = new Set(["목사", "장로", "권사", "안수집사", "집사", "전도사", "성도", "청년"]);

export function parseYouTubeDescription(description: string): YouTubeDescriptionFields {
  const result: YouTubeDescriptionFields = {};
  for (const line of description.split(/\r?\n/u)) {
    const match = line.match(/^\s*(찬양|설교\s*제목|설교\s*본문|대표\s*기도)\s*[:：]\s*(.*?)\s*$/u);
    if (!match || !match[2]) continue;
    const label = match[1].replace(/\s+/gu, "");
    const value = match[2].trim();
    if (label === "찬양") {
      const songs = dedupeSongTitles(value.split("/").map((item) => item.trim()).filter(Boolean)).map((song) => song.displayTitle);
      if (songs.length) result.songs = songs;
    } else if (label === "설교제목") result.sermonTitle = value;
    else if (label === "설교본문") result.biblePassage = value;
    else {
      const parts = value.split(/\s+/u);
      const last = parts.at(-1) ?? "";
      if (parts.length > 1 && PRAYER_ROLES.has(last)) {
        result.prayerName = parts.slice(0, -1).join(" ");
        result.prayerRole = last;
      } else result.prayerName = value;
    }
  }
  return result;
}
