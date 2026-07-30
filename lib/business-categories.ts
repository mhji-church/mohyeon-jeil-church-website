export const businessCategories = [
  "음식점",
  "카페·디저트",
  "병원·의료",
  "학원·교육",
  "인쇄소",
  "정육점",
  "미용실",
  "피부관리샵",
  "건축·인테리어",
  "전기·설비",
  "자동차·운송",
  "부동산",
  "소매·유통",
  "농업·원예",
  "전문서비스",
  "기타",
] as const;

export type BusinessCategory = (typeof businessCategories)[number];

export function isBusinessCategory(value: string) {
  return businessCategories.includes(value as BusinessCategory);
}
