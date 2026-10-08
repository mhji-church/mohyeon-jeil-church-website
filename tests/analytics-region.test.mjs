import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTrustedAnalyticsGeo, koreanDistrictName, summarizeDomesticRegions } from "../lib/analytics-region.ts";

test("trusted Netlify subdivisions and city spellings resolve only to matching official districts", () => {
  for (const city of ["Yongin", "Yongin-si", "Yongin City", "용인시", "41460"]) {
    const location = normalizeTrustedAnalyticsGeo({ available: true, countryCode: "KR", subdivisionCode: "KR-41", city });
    assert.deepEqual(location, { countryCode: "KR", regionCode: "41", cityCode: "41460", geoStatus: "available" });
  }
  assert.equal(koreanDistrictName("41460"), "경기도 용인시");
  assert.equal(normalizeTrustedAnalyticsGeo({ available: true, countryCode: "KR", subdivisionCode: "41", city: "Seongnam-si" }).cityCode, "41130");
  assert.equal(normalizeTrustedAnalyticsGeo({ available: true, countryCode: "KR", subdivisionName: "경기도", city: "성남시" }).cityCode, "41130");
  assert.equal(normalizeTrustedAnalyticsGeo({ available: true, countryCode: "KR", subdivisionCode: "KR-11", city: "Yongin" }).cityCode, "");
  assert.equal(normalizeTrustedAnalyticsGeo({ available: true, countryCode: "KR", subdivisionCode: "KR-41", subdivisionName: "서울특별시", city: "Yongin" }).regionCode, "");
  assert.equal(normalizeTrustedAnalyticsGeo({ available: true, countryCode: "KR", subdivisionCode: "KR-41", city: "처인구" }).cityCode, "");
  assert.equal(normalizeTrustedAnalyticsGeo({ available: false, countryCode: "KR", subdivisionCode: "KR-41", city: "Yongin" }).geoStatus, "unsupported");
  assert.equal(normalizeTrustedAnalyticsGeo({ available: true, countryCode: "US", subdivisionCode: "KR-41", city: "Yongin" }).cityCode, "");
});

test("domestic visits use one session each, include unknowns in denominator, and separate past collection", () => {
  const rows = [
    { region_code: "41", city_code: "41460", geo_status: "available", visits: 2 },
    { region_code: "41", city_code: "41130", geo_status: "available", visits: 1 },
    { region_code: "41", city_code: "", geo_status: "available", visits: 1 },
    { region_code: "11", city_code: "", geo_status: "available", visits: 1 },
    { region_code: "", city_code: "", geo_status: "available", visits: 1 },
    { region_code: "", city_code: "", geo_status: "legacy", visits: 1 },
  ];
  const result = summarizeDomesticRegions(rows, "2026-10-05", "2026-10-09");
  assert.equal(result.domesticVisits, 7);
  assert.equal(result.cityKnownVisits, 3);
  assert.equal(result.yonginVisits, 2);
  assert.equal(result.precollectionVisits, 1);
  assert.deepEqual(result.cities.find((row) => row.label === "경기도 · 시군구 미확인"), { label: "경기도 · 시군구 미확인", visits: 1 });
  assert.deepEqual(result.cities.find((row) => row.label === "알 수 없음"), { label: "알 수 없음", visits: 1 });
  assert.equal(result.cities.reduce((sum, row) => sum + row.visits, 0), result.domesticVisits);
  assert.equal(result.provinces.reduce((sum, row) => sum + row.visits, 0), result.domesticVisits);
  assert.equal(summarizeDomesticRegions(rows, "2026-10-05", "2026-10-04").status, "precollection");
  assert.equal(summarizeDomesticRegions([], "2026-10-05", "2026-10-09").status, "empty");
  assert.equal(summarizeDomesticRegions([], "2026-10-05", "2026-10-09", false).status, "unsupported");
  assert.equal(summarizeDomesticRegions([{ region_code: "", city_code: "", geo_status: "unsupported", visits: 1 }], "2026-10-05", "2026-10-09").status, "unsupported");
  assert.equal(summarizeDomesticRegions([{ region_code: "41", city_code: "", geo_status: "available", visits: 1 }], "2026-10-05", "2026-10-09").cityStatus, "unsupported");
});

test("only five confirmed districts are ranked and other confirmed districts stay distinct from unknown", () => {
  const codes = ["41460", "41130", "41110", "41210", "41360", "41570"];
  const result = summarizeDomesticRegions([
    ...codes.map((city_code, index) => ({ region_code: "41", city_code, geo_status: "available", visits: 6 - index })),
    { region_code: "41", city_code: "", geo_status: "available", visits: 2 },
  ], "2026-10-05", "2026-10-09");
  assert.equal(result.cities.filter((row) => row.label === "기타 지역").length, 1);
  assert.equal(result.cities.find((row) => row.label === "기타 지역")?.visits, 1);
  assert.equal(result.cities.find((row) => row.label === "경기도 · 시군구 미확인")?.visits, 2);
  assert.equal(result.cities.reduce((sum, row) => sum + row.visits, 0), result.domesticVisits);
});
