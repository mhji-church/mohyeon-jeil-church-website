import { getMobilePhoneDigits } from "./phone";

export const EARLIEST_BIRTH_YEAR = 1900;

export function normalizeMemberName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function normalizeMemberLogin(value: string) {
  return normalizeMemberName(value).toLocaleLowerCase("ko-KR");
}

export function validateMemberBirthDate(
  value: string,
  now = new Date(),
): { value?: string; error?: string } {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    return { error: "생년월일을 연도 4자리, 월 2자리, 일 2자리로 입력해 주세요." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < EARLIEST_BIRTH_YEAR) {
    return { error: `출생연도는 ${EARLIEST_BIRTH_YEAR}년 이후로 입력해 주세요.` };
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { error: "실제로 존재하는 생년월일을 입력해 주세요." };
  }

  const today = [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-");
  if (normalized > today) {
    return { error: "미래 날짜는 생년월일로 입력할 수 없습니다." };
  }

  return { value: normalized };
}

export function validateNewMemberPassword(
  password: string,
  birthDate: string,
  phone: string,
): { value?: string; error?: string } {
  if (!/^\d{6}$/.test(password)) {
    return { error: "로그인 비밀번호는 숫자 6자리로 입력해 주세요." };
  }
  if (/^(\d)\1{5}$/.test(password)) {
    return { error: "같은 숫자만 반복한 비밀번호는 사용할 수 없습니다." };
  }

  const compactBirthDate = birthDate.replace(/\D/g, "");
  if (compactBirthDate.length === 8 && password === compactBirthDate.slice(2)) {
    return { error: "생년월일과 같은 비밀번호는 사용할 수 없습니다." };
  }

  const phoneDigits = getMobilePhoneDigits(phone);
  if (phoneDigits.length === 11 && password.endsWith(phoneDigits.slice(-4))) {
    return { error: "휴대전화 번호 뒤 4자리가 들어간 비밀번호는 사용할 수 없습니다." };
  }

  return { value: password };
}

export function memberLoginCandidate(
  name: string,
  phone: string,
  attempt: number,
) {
  const base = normalizeMemberLogin(name);
  if (attempt === 0) return base;
  const lastFour = getMobilePhoneDigits(phone).slice(-4);
  if (attempt === 1) return `${base}${lastFour}`;
  return `${base}${lastFour}-${attempt}`;
}
