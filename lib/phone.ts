const MOBILE_PHONE_DIGIT_LIMIT = 11;

export function getMobilePhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, MOBILE_PHONE_DIGIT_LIMIT);
}

export function formatMobilePhone(value: string) {
  const digits = getMobilePhoneDigits(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function normalizeMobilePhone(value: string) {
  const digits = getMobilePhoneDigits(value);
  return /^010\d{8}$/.test(digits) ? formatMobilePhone(digits) : null;
}
