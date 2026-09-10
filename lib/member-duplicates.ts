export type MemberDuplicateField = "phone" | "birthDate";

export type DuplicateMemberCandidate = {
  id: string;
  username: string;
  name: string;
  phone: string;
  birthDate: string;
  status: string;
  createdAt: string;
};

export type MemberDuplicateMatch = {
  id: string;
  username: string;
  name: string;
  status: string;
  createdAt: string;
  matchedFields: MemberDuplicateField[];
};

export type MemberDuplicateCheck = {
  matchedFields: MemberDuplicateField[];
  matches: MemberDuplicateMatch[];
  fingerprint: string;
};

export function normalizeDuplicatePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("008210")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("8210")) digits = `0${digits.slice(2)}`;
  return /^010\d{8}$/.test(digits) ? digits : null;
}

export function normalizeDuplicateBirthDate(value: string) {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return normalized <= new Date().toISOString().slice(0, 10) ? normalized : null;
}

export function findMemberDuplicateCheck(
  target: DuplicateMemberCandidate,
  members: DuplicateMemberCandidate[],
): MemberDuplicateCheck | null {
  const phone = normalizeDuplicatePhone(target.phone);
  const birthDate = normalizeDuplicateBirthDate(target.birthDate);
  if (!phone && !birthDate) return null;

  const matches = members
    .filter((member) => member.id !== target.id)
    .map((member): MemberDuplicateMatch | null => {
      const matchedFields: MemberDuplicateField[] = [];
      if (phone && normalizeDuplicatePhone(member.phone) === phone) matchedFields.push("phone");
      if (birthDate && normalizeDuplicateBirthDate(member.birthDate) === birthDate) matchedFields.push("birthDate");
      if (!matchedFields.length) return null;
      return {
        id: member.id,
        username: member.username,
        name: member.name,
        status: member.status,
        createdAt: member.createdAt,
        matchedFields,
      };
    })
    .filter((match): match is MemberDuplicateMatch => Boolean(match))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (!matches.length) return null;
  const matchedFields: MemberDuplicateField[] = [];
  if (matches.some((match) => match.matchedFields.includes("phone"))) matchedFields.push("phone");
  if (matches.some((match) => match.matchedFields.includes("birthDate"))) matchedFields.push("birthDate");
  return {
    matchedFields,
    matches,
    fingerprint: JSON.stringify(matches.map((match) => ({
      id: match.id,
      username: match.username,
      name: match.name,
      status: match.status,
      createdAt: match.createdAt,
      matchedFields: match.matchedFields,
    }))),
  };
}
