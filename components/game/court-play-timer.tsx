"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import {
  COURT_CANCEL_GRACE_MS,
  formatCourtCancelCountdown,
  formatCourtElapsedTime,
  getCourtCancelGraceRemainingMs,
  getCourtElapsedMs,
  isCourtTimerPaused,
  type CourtTimerClock,
} from "@/lib/court-cancel-grace";
import { cn } from "@/lib/utils";

export function useCourtPlayTimer(clock: CourtTimerClock) {
  const [now, setNow] = useState(() => Date.now());
  const paused = isCourtTimerPaused(clock);

  useEffect(() => {
    if (!clock.startedAt || paused) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [clock.startedAt, clock.pausedAt, paused]);

  const effectiveNow = paused && clock.pausedAt ? new Date(clock.pausedAt).getTime() : now;
  const elapsedMs = getCourtElapsedMs(clock, effectiveNow);
  const cancelRemainingMs = getCourtCancelGraceRemainingMs(clock, effectiveNow);

  return {
    elapsedMs,
    elapsedLabel: formatCourtElapsedTime(elapsedMs),
    canCancel: cancelRemainingMs > 0,
    cancelRemainingMs,
    cancelLabel: formatCourtCancelCountdown(cancelRemainingMs),
    cancelProgress: cancelRemainingMs / COURT_CANCEL_GRACE_MS,
    paused,
  };
}

function PlayTimerIcon() {
  return (
    <span className="relative inline-flex size-9 shrink-0 items-center justify-center">
      <span className="court-play-timer-shell relative flex size-7 items-center justify-center rounded-full bg-emerald-500/10">
        <Clock className="court-play-timer-icon size-4 text-emerald-600 dark:text-emerald-400" />
      </span>
    </span>
  );
}

export function CourtInPlayElapsedPanel({
  clock,
  className,
}: {
  clock: CourtTimerClock;
  className?: string;
}) {
  const { canCancel, elapsedLabel, paused } = useCourtPlayTimer(clock);

  if (canCancel || !clock.startedAt) return null;

  return (
    <div
      className={cn(
        "court-in-play-timer flex h-11 w-full items-center gap-2.5 rounded-lg border px-3",
        paused
          ? "border-amber-500/25 bg-amber-500/5"
          : "border-emerald-500/25 bg-emerald-500/5",
        className,
      )}
      aria-live="polite"
      aria-label={paused ? `Paused at ${elapsedLabel}` : `Playing for ${elapsedLabel}`}
    >
      <PlayTimerIcon />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate text-left text-sm font-medium text-foreground">
          {paused ? "Paused" : "Playing"}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 font-mono text-sm font-semibold tabular-nums",
            paused
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {elapsedLabel}
        </span>
      </span>
    </div>
  );
}
