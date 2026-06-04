export type MatchTimeFields = {
  startedAt?: string | null;
  endedAt: string;
  durationSeconds: number;
};

export function resolveMatchStartedAt(match: MatchTimeFields): Date {
  if (match.startedAt) {
    const started = new Date(match.startedAt);
    if (!Number.isNaN(started.getTime())) return started;
  }
  const ended = new Date(match.endedAt);
  return new Date(ended.getTime() - Math.max(0, match.durationSeconds) * 1000);
}

export function resolveMatchEndedAt(match: MatchTimeFields): Date {
  const ended = new Date(match.endedAt);
  return Number.isNaN(ended.getTime()) ? new Date() : ended;
}

/** Short clock time for match history (e.g. "2:15 PM"). */
export function formatMatchClockTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatMatchPlayedDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s played`;
  if (remainder === 0) return `${minutes}m played`;
  return `${minutes}m ${remainder}s played`;
}

export function formatMatchTimeRange(match: MatchTimeFields): string {
  const started = resolveMatchStartedAt(match);
  const ended = resolveMatchEndedAt(match);
  return `${formatMatchClockTime(started)} – ${formatMatchClockTime(ended)}`;
}
