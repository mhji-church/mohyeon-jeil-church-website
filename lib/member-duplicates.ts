export type MemberDuplicateField = "phone" | "birthDate";

export type DuplicateMemberCandidate = {
  id: string;
  username: string;
  name: string;
  phone: string;
  birthDate: string;
  position?: string;
  status: string;
  lastLoginAt?: string | null;
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

export type MemberDuplicateGroupAccount = DuplicateMemberCandidate & {
  matchedFields: MemberDuplicateField[];
  isFirst: boolean;
};

export type MemberDuplicateGroup = {
  id: string;
  fingerprint: string;
  matchedFields: MemberDuplicateField[];
  differentNames: boolean;
  hasPending: boolean;
  latestAdditionalAt: string;
  accounts: MemberDuplicateGroupAccount[];
};

export type MemberDuplicateSummary = {
  groupCount: number;
  accountCount: number;
  additionalCount: number;
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

function matchingFields(left: DuplicateMemberCandidate, right: DuplicateMemberCandidate) {
  const fields: MemberDuplicateField[] = [];
  const leftPhone = normalizeDuplicatePhone(left.phone);
  const rightPhone = normalizeDuplicatePhone(right.phone);
  if (leftPhone && rightPhone && leftPhone === rightPhone) fields.push("phone");
  const leftBirthDate = normalizeDuplicateBirthDate(left.birthDate);
  const rightBirthDate = normalizeDuplicateBirthDate(right.birthDate);
  if (leftBirthDate && rightBirthDate && leftBirthDate === rightBirthDate) fields.push("birthDate");
  return fields;
}

export function buildMemberDuplicateGroups(members: DuplicateMemberCandidate[]): MemberDuplicateGroup[] {
  const parents = members.map((_, index) => index);
  const root = (index: number): number => {
    if (parents[index] !== index) parents[index] = root(parents[index]);
    return parents[index];
  };
  const join = (left: number, right: number) => {
    const leftRoot = root(left);
    const rightRoot = root(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  for (let left = 0; left < members.length; left += 1) {
    for (let right = left + 1; right < members.length; right += 1) {
      if (matchingFields(members[left], members[right]).length) join(left, right);
    }
  }

  const components = new Map<number, DuplicateMemberCandidate[]>();
  members.forEach((member, index) => {
    const key = root(index);
    components.set(key, [...(components.get(key) ?? []), member]);
  });

  return [...components.values()]
    .filter((accounts) => accounts.length > 1)
    .map((component): MemberDuplicateGroup => {
      const sorted = [...component].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
      const accounts = sorted.map((member, index): MemberDuplicateGroupAccount => {
        const fields: MemberDuplicateField[] = [];
        for (const other of sorted) {
          if (other.id === member.id) continue;
          for (const field of matchingFields(member, other)) {
            if (!fields.includes(field)) fields.push(field);
          }
        }
        return { ...member, matchedFields: fields, isFirst: index === 0 };
      });
      const matchedFields: MemberDuplicateField[] = [];
      if (accounts.some((account) => account.matchedFields.includes("phone"))) matchedFields.push("phone");
      if (accounts.some((account) => account.matchedFields.includes("birthDate"))) matchedFields.push("birthDate");
      const ids = accounts.map((account) => account.id).sort();
      return {
        id: `duplicate:${ids.join(":")}`,
        fingerprint: JSON.stringify(accounts.map((account) => ({
          id: account.id,
          username: account.username,
          name: account.name,
          phone: normalizeDuplicatePhone(account.phone),
          birthDate: normalizeDuplicateBirthDate(account.birthDate),
          position: account.position ?? "",
          status: account.status,
          createdAt: account.createdAt,
          matchedFields: account.matchedFields,
        }))),
        matchedFields,
        differentNames: new Set(accounts.map((account) => account.name.trim())).size > 1,
        hasPending: accounts.some((account) => account.status === "pending"),
        latestAdditionalAt: accounts.slice(1).reduce(
          (latest, account) => account.createdAt > latest ? account.createdAt : latest,
          accounts[1]?.createdAt ?? accounts[0].createdAt,
        ),
        accounts,
      };
    })
    .sort((left, right) =>
      Number(right.hasPending) - Number(left.hasPending) ||
      right.latestAdditionalAt.localeCompare(left.latestAdditionalAt) ||
      left.id.localeCompare(right.id));
}

export function summarizeMemberDuplicateGroups(groups: MemberDuplicateGroup[]): MemberDuplicateSummary {
  const accountCount = groups.reduce((sum, group) => sum + group.accounts.length, 0);
  return { groupCount: groups.length, accountCount, additionalCount: accountCount - groups.length };
}

export function findMemberDuplicateCheck(
  target: DuplicateMemberCandidate,
  members: DuplicateMemberCandidate[],
): MemberDuplicateCheck | null {
  const group = buildMemberDuplicateGroups(members)
    .find((candidate) => candidate.accounts.some((account) => account.id === target.id));
  if (!group) return null;
  const matches = group.accounts
    .filter((member) => member.id !== target.id)
    .map((member): MemberDuplicateMatch | null => {
      const fields = matchingFields(target, member);
      return fields.length ? {
        id: member.id,
        username: member.username,
        name: member.name,
        status: member.status,
        createdAt: member.createdAt,
        matchedFields: fields,
      } : null;
    })
    .filter((match): match is MemberDuplicateMatch => Boolean(match));
  const matchedFields: MemberDuplicateField[] = [];
  if (matches.some((match) => match.matchedFields.includes("phone"))) matchedFields.push("phone");
  if (matches.some((match) => match.matchedFields.includes("birthDate"))) matchedFields.push("birthDate");
  return { matchedFields, matches, fingerprint: group.fingerprint };
}
