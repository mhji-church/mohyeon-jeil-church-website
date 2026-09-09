export function getMemberDisplayPosition(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  return normalized.split("/", 1)[0].trim();
}
