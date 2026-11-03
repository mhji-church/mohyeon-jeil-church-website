// Stored full dates define YYMMDD; never infer a century from the input.
export function birthDateRecoveryHint(storedDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(storedDate.trim());
  if (!match || Number(match[1]) < 1900) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() || date.toISOString().slice(0, 10) !== storedDate.trim()) return null;
  return `${match[1].slice(2)}${match[2]}${match[3]}`;
}

export const MEMBER_RECOVERY_INVALID = "입력 정보가 일치하지 않거나 재설정 시간이 만료되었습니다. 이름과 생년월일을 확인하고 처음부터 다시 시도해 주세요.";
