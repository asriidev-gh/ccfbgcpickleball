export const COURT_CANCEL_GRACE_MS = 5 * 60 * 1000;

export type CourtTimerClock = {
  startedAt?: Date | string | null;
  pausedAt?: Date | string | null;
  totalPausedMs?: number | null;
};

function parseTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function getCourtActivePauseMs(clock: CourtTimerClock, now = Date.now()) {
  const pausedAt = parseTime(clock.pausedAt);
  if (pausedAt == null) return 0;
  return Math.max(0, now - pausedAt);
}

export function getCourtEffectiveElapsedMs(clock: CourtTimerClock, now = Date.now()) {
  const startedAt = parseTime(clock.startedAt);
  if (startedAt == null) return 0;

  const totalPaused = Math.max(0, clock.totalPausedMs ?? 0);
  const activePause = getCourtActivePauseMs(clock, now);
  return Math.max(0, now - startedAt - totalPaused - activePause);
}

export function isCourtTimerPaused(clock: CourtTimerClock) {
  return Boolean(clock.pausedAt);
}

export function getCourtCancelGraceRemainingMs(
  clock: CourtTimerClock | Date | string | null | undefined,
  now = Date.now(),
) {
  const timerClock: CourtTimerClock =
    clock != null && typeof clock === "object" && ("pausedAt" in clock || "totalPausedMs" in clock)
      ? (clock as CourtTimerClock)
      : { startedAt: clock as Date | string | null | undefined };

  if (!timerClock.startedAt) return 0;
  return Math.max(0, COURT_CANCEL_GRACE_MS - getCourtEffectiveElapsedMs(timerClock, now));
}

export function canCancelCourtAssignment(
  clock: CourtTimerClock | Date | string | null | undefined,
  now = Date.now(),
) {
  return getCourtCancelGraceRemainingMs(clock, now) > 0;
}

export function formatCourtCancelCountdown(remainingMs: number) {
  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getCourtElapsedMs(
  clock: CourtTimerClock | Date | string | null | undefined,
  now = Date.now(),
) {
  const timerClock: CourtTimerClock =
    clock != null && typeof clock === "object" && ("pausedAt" in clock || "totalPausedMs" in clock)
      ? (clock as CourtTimerClock)
      : { startedAt: clock as Date | string | null | undefined };

  return getCourtEffectiveElapsedMs(timerClock, now);
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

export function toCourtTimerClock(court: {
  startedAt?: Date | string | null;
  pausedAt?: Date | string | null;
  totalPausedMs?: number | null;
}): CourtTimerClock {
  return {
    startedAt: court.startedAt ?? null,
    pausedAt: court.pausedAt ?? null,
    totalPausedMs: court.totalPausedMs ?? 0,
  };
}

export function clearCourtTimerPauseFields() {
  return {
    pausedAt: null,
    totalPausedMs: 0,
  };
}
