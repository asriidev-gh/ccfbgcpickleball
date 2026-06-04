"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import {
  COURT_CANCEL_GRACE_MS,
  formatCourtCancelCountdown,
  formatCourtElapsedTime,
  getCourtCancelGraceRemainingMs,
  getCourtElapsedMs,
} from "@/lib/court-cancel-grace";
import { cn } from "@/lib/utils";

export function useCourtPlayTimer(startedAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsedMs = getCourtElapsedMs(startedAt, now);
  const cancelRemainingMs = getCourtCancelGraceRemainingMs(startedAt, now);

  return {
    elapsedMs,
    elapsedLabel: formatCourtElapsedTime(elapsedMs),
    canCancel: cancelRemainingMs > 0,
    cancelRemainingMs,
    cancelLabel: formatCourtCancelCountdown(cancelRemainingMs),
    cancelProgress: cancelRemainingMs / COURT_CANCEL_GRACE_MS,
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
  startedAt,
  className,
}: {
  startedAt: string | null | undefined;
  className?: string;
}) {
  const { canCancel, elapsedLabel } = useCourtPlayTimer(startedAt);

  if (canCancel || !startedAt) return null;

  return (
    <div
      className={cn(
        "court-in-play-timer flex h-11 w-full items-center gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3",
        className,
      )}
      aria-live="polite"
      aria-label={`Playing for ${elapsedLabel}`}
    >
      <PlayTimerIcon />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate text-left text-sm font-medium text-foreground">Playing</span>
        <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          {elapsedLabel}
        </span>
      </span>
    </div>
  );
}
