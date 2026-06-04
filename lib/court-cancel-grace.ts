export const COURT_CANCEL_GRACE_MS = 5 * 60 * 1000;

export function getCourtCancelGraceRemainingMs(
  startedAt: Date | string | null | undefined,
  now = Date.now(),
) {
  if (!startedAt) return 0;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, COURT_CANCEL_GRACE_MS - (now - started));
}

export function canCancelCourtAssignment(
  startedAt: Date | string | null | undefined,
  now = Date.now(),
) {
  return getCourtCancelGraceRemainingMs(startedAt, now) > 0;
}

export function formatCourtCancelCountdown(remainingMs: number) {
  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getCourtElapsedMs(
  startedAt: Date | string | null | undefined,
  now = Date.now(),
) {
  if (!startedAt) return 0;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, now - started);
}

/** Live elapsed play time — e.g. 4:32 or 1:05:12 */
export function formatCourtElapsedTime(elapsedMs: number) {
  const totalSec = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
