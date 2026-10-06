const koreaAuditTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function formatAdminAuditTime(value: string) {
  // SQLite CURRENT_TIMESTAMP is UTC but does not include a timezone suffix.
  const timestamp = value.trim().replace(" ", "T");
  const dated = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  if (Number.isNaN(dated.getTime())) return value;
  const parts = Object.fromEntries(koreaAuditTime.formatToParts(dated).map((part) => [part.type, part.value]));
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST`;
}
