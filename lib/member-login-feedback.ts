export function loginRetryDeadline(retryAfter: string | null, receivedAt = Date.now()): number | null {
  if (!retryAfter?.trim()) return null;
  const value = retryAfter.trim();
  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    const deadline = receivedAt + seconds * 1000;
    return Number.isSafeInteger(seconds) && seconds > 0 && deadline <= 8.64e15 ? deadline : null;
  }
  const deadline = Date.parse(value);
  return Number.isFinite(deadline) && deadline > receivedAt ? deadline : null;
}

export function loginSecondsRemaining(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function loginWaitMessage(seconds: number) {
  return `로그인 시도가 많아 일시적으로 제한되었습니다. ${Math.floor(seconds / 60)}분 ${seconds % 60}초 후 다시 시도해 주세요.`;
}

export function loginWaitClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export const LOGIN_WAIT_FINISHED_MESSAGE = "다시 로그인할 수 있습니다. 입력 정보를 확인해 주세요.";
