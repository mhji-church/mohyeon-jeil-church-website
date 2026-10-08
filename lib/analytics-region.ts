import { KOREAN_DISTRICTS } from "./korean-regions-data.mjs";

// The codes are the first two digits of the official legal-dong code. Netlify
// supplies ISO 3166-2 subdivision codes with the same numeric suffix.
const provinces: Record<string, string> = {
  "11": "서울특별시", "12": "전남광주통합특별시", "26": "부산광역시",
  "27": "대구광역시", "28": "인천광역시", "30": "대전광역시",
  "31": "울산광역시", "36": "세종특별자치시", "41": "경기도",
  "43": "충청북도", "44": "충청남도", "47": "경상북도",
  "48": "경상남도", "50": "제주특별자치도", "51": "강원특별자치도",
  "52": "전북특별자치도",
};

const initials = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const vowels = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const finals = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

function romanize(value: string) {
  return [...value].map((character) => {
    const syllable = character.charCodeAt(0) - 0xac00;
    if (syllable < 0 || syllable >= 11172) return character;
    return initials[Math.floor(syllable / 588)] + vowels[Math.floor(syllable % 588 / 28)] + finals[syllable % 28];
  }).join("");
}

function key(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function aliases(value: string) {
  const withoutSuffix = /[시군구도]$/.test(value) ? value.slice(0, -1) : value;
  const englishSuffix = value.endsWith("시") ? "city" : value.endsWith("군") ? "county" : value.endsWith("구") ? "district" : "";
  return [key(value), key(withoutSuffix), key(romanize(value)), key(romanize(withoutSuffix)), ...(englishSuffix ? [key(romanize(withoutSuffix) + englishSuffix)] : [])];
}

const provinceByAlias = new Map<string, string>();
for (const [code, name] of Object.entries(provinces)) {
  for (const alias of aliases(name)) provinceByAlias.set(alias, code);
}
for (const [alias, code] of Object.entries({
  gyeonggi: "41", gangwon: "51", jeju: "50", jeonbuk: "52",
  seoul: "11", busan: "26", pusan: "26", daegu: "27",
  incheon: "28", daejeon: "30", ulsan: "31", sejong: "36",
  chungbuk: "43", chungnam: "44", gyeongbuk: "47", gyeongnam: "48",
})) provinceByAlias.set(alias, code);

const districtByProvince = new Map<string, Map<string, string>>();
const districtNameByCode = new Map<string, string>();
for (const [code, province, district] of KOREAN_DISTRICTS) {
  const provinceCode = code.slice(0, 2);
  if (provinces[provinceCode] !== province) continue;
  districtNameByCode.set(code, `${province} ${district}`);
  const names = districtByProvince.get(provinceCode) ?? new Map<string, string>();
  for (const alias of aliases(district)) names.set(alias, code);
  districtByProvince.set(provinceCode, names);
}

export type TrustedAnalyticsGeo = {
  available: boolean;
  countryCode?: string;
  subdivisionCode?: string;
  subdivisionName?: string;
  city?: string;
};

export function normalizeTrustedAnalyticsGeo(geo: TrustedAnalyticsGeo) {
  if (!geo.available) return { countryCode: "ZZ", regionCode: "", cityCode: "", geoStatus: "unsupported" };
  const countryCode = /^[A-Z]{2}$/.test(geo.countryCode?.toUpperCase() ?? "") ? geo.countryCode!.toUpperCase() : "ZZ";
  if (countryCode !== "KR") return { countryCode, regionCode: "", cityCode: "", geoStatus: "available" };
  const rawCode = (geo.subdivisionCode ?? "").toUpperCase();
  const fromCode = /^(?:KR-)?(\d{2})$/.exec(rawCode)?.[1] ?? "";
  const fromName = provinceByAlias.get(key(geo.subdivisionName ?? "")) ?? "";
  const regionCode = fromCode && provinces[fromCode] && (!fromName || fromName === fromCode) ? fromCode : !fromCode ? fromName : "";
  const cityKey = key(geo.city ?? "");
  const cityCode = regionCode && cityKey ? (/^\d{5}$/.test(cityKey) && cityKey.startsWith(regionCode) && districtNameByCode.has(cityKey) ? cityKey : districtByProvince.get(regionCode)?.get(cityKey) ?? "") : "";
  return { countryCode, regionCode, cityCode, geoStatus: "available" };
}

const number = (value: unknown) => Number(value ?? 0) || 0;
const string = (value: unknown) => String(value ?? "");
type RegionalRow = Record<string, unknown>;

export function summarizeDomesticRegions(input: RegionalRow[], collectionDay: string, rangeEnd: string, providerAvailable = true) {
  const cityCounts = new Map<string, number>();
  const provinceCounts = new Map<string, number>();
  const unknownCities = new Map<string, number>();
  let domesticVisits = 0, cityKnownVisits = 0, yonginVisits = 0;
  let precollectionVisits = 0, unsupportedVisits = 0, supportedVisits = 0, unknownRegionVisits = 0;
  for (const row of input) {
    const visits = number(row.visits);
    domesticVisits += visits;
    const status = string(row.geo_status);
    if (status === "legacy") { precollectionVisits += visits; continue; }
    if (status !== "available") { unsupportedVisits += visits; continue; }
    supportedVisits += visits;
    const regionCode = string(row.region_code);
    const regionName = koreanRegionName(regionCode);
    if (regionName) provinceCounts.set(regionName, (provinceCounts.get(regionName) ?? 0) + visits);
    else unknownRegionVisits += visits;
    const cityCode = string(row.city_code);
    const cityName = regionCode && cityCode.startsWith(regionCode) ? koreanDistrictName(cityCode) : "";
    if (cityName) {
      cityCounts.set(cityName, (cityCounts.get(cityName) ?? 0) + visits);
      cityKnownVisits += visits;
      if (cityCode === YONGIN_DISTRICT_CODE) yonginVisits += visits;
    } else {
      const label = regionName ? `${regionName} · 시군구 미확인` : "알 수 없음";
      unknownCities.set(label, (unknownCities.get(label) ?? 0) + visits);
    }
  }
  const ranked = (counts: Map<string, number>) => [...counts].map(([label, visits]) => ({ label, visits })).sort((a, b) => b.visits - a.visits || a.label.localeCompare(b.label, "ko"));
  const topFive = (counts: Map<string, number>) => {
    const all = ranked(counts);
    const rows = all.slice(0, 5);
    const rest = all.slice(5).reduce((sum, item) => sum + item.visits, 0);
    return rest ? [...rows, { label: "기타 지역", visits: rest }] : rows;
  };
  const status = rangeEnd < collectionDay || (precollectionVisits > 0 && supportedVisits + unsupportedVisits === 0) ? "precollection" : domesticVisits === 0 ? (providerAvailable ? "empty" : "unsupported") : supportedVisits === 0 ? "unsupported" : "available";
  return {
    collectionDay, status, domesticVisits, cityKnownVisits, yonginVisits,
    cityStatus: supportedVisits > 0 && cityKnownVisits > 0 ? "available" : "unsupported",
    precollectionVisits, unsupportedVisits,
    cities: [...topFive(cityCounts), ...ranked(unknownCities), ...(precollectionVisits ? [{ label: "수집 전", visits: precollectionVisits }] : []), ...(unsupportedVisits ? [{ label: "지역 정보 미지원", visits: unsupportedVisits }] : [])],
    provinces: [...topFive(provinceCounts), ...(unknownRegionVisits ? [{ label: "알 수 없음", visits: unknownRegionVisits }] : []), ...(precollectionVisits ? [{ label: "수집 전", visits: precollectionVisits }] : []), ...(unsupportedVisits ? [{ label: "지역 정보 미지원", visits: unsupportedVisits }] : [])],
  };
}

export function koreanRegionName(code: string) { return provinces[code] ?? ""; }
export function koreanDistrictName(code: string) { return districtNameByCode.get(code) ?? ""; }
export const YONGIN_DISTRICT_CODE = "41460";
