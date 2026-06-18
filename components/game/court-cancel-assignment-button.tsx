"use client";

import { Clock, Loader2 } from "lucide-react";

import { useCourtPlayTimer } from "@/components/game/court-play-timer";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import type { CourtTimerClock } from "@/lib/court-cancel-grace";
import { cn } from "@/lib/utils";

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CancelCountdownIcon({ progress }: { progress: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <span className="relative inline-flex size-9 shrink-0 items-center justify-center">
      <svg
        className="absolute size-9 -rotate-90"
        viewBox="0 0 36 36"
        aria-hidden
      >
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          className="stroke-muted-foreground/20"
          strokeWidth="2.5"
        />
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="court-cancel-clock-shell relative flex size-6 items-center justify-center rounded-full bg-primary/10">
        <Clock className="court-cancel-clock-icon size-3.5 text-primary" aria-hidden />
      </span>
    </span>
  );
}

type CourtCancelGraceVariant = "assignment" | "rematch";

const CANCEL_GRACE_VARIANTS = {
  assignment: {
    label: "Cancel assignment",
    tooltipPrefix: "Cancel within",
    buttonClass: "court-cancel-assignment-btn",
  },
  rematch: {
    label: "Cancel rematch",
    tooltipPrefix: "Cancel within",
    buttonClass: "court-cancel-rematch-btn",
  },
} as const;

type CourtCancelAssignmentButtonProps = {
  clock: CourtTimerClock;
  onClick: () => void;
  pending?: boolean;
  className?: string;
  variant?: CourtCancelGraceVariant;
};

export function CourtCancelAssignmentButton({
  clock,
  onClick,
  pending = false,
  className,
  variant = "assignment",
}: CourtCancelAssignmentButtonProps) {
  const { canCancel, cancelLabel, cancelProgress, paused } = useCourtPlayTimer(clock);
  const config = CANCEL_GRACE_VARIANTS[variant];

  if (!canCancel && !pending) return null;

  return (
    <SimpleTooltip
      label={`${config.tooltipPrefix} ${cancelLabel} of ${
        variant === "rematch" ? "rematch start" : "court fill"
      }${paused ? " (paused)" : ""}`}
    >
      <Button
        type="button"
        variant="outline"
        className={cn(config.buttonClass, "h-11 w-full gap-2.5 px-3", className)}
        disabled={pending || !canCancel}
        onClick={onClick}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            <span>Cancelling…</span>
          </>
        ) : (
          <>
            <CancelCountdownIcon progress={cancelProgress} />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate text-left text-sm">{config.label}</span>
              <span
                className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-primary"
                aria-live="polite"
              >
                {cancelLabel}
              </span>
            </span>
          </>
        )}
      </Button>
    </SimpleTooltip>
  );
}
