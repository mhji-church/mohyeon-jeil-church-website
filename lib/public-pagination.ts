export const PUBLIC_CONTENT_PAGE_SIZE = 10;

export function normalizeContentPage(value: unknown, totalPages: number) {
  const parsed = typeof value === "string" && /^\d+$/.test(value)
    ? Number.parseInt(value, 10)
    : 1;
  return Math.min(Math.max(parsed, 1), Math.max(totalPages, 1));
}

export function contentPageForRow(rowNumber: number, pageSize = PUBLIC_CONTENT_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(rowNumber, 1) / pageSize));
}
