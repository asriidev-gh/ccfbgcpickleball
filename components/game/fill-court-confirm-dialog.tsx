"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Loader2, Play, Shuffle, Volume2, VolumeX } from "lucide-react";

import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolvePlayerPhotoUrl } from "@/lib/player-avatar-url";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

const SHUFFLE_DURATION_MS = 3000;
const SHUFFLE_TICK_MS = 75;
const SHUFFLE_REVEAL_MS = 650;

type FillCourtConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courtNumber: number | null;
  teamA: QueueEntryView[];
  teamB: QueueEntryView[];
  canReplace: boolean;
  onReplace: (sourceIndex: number, sourceEntry: QueueEntryView) => void;
  replacePendingSourceIndex: number | null;
  onConfirmFill: () => void;
  fillPending?: boolean;
  onShuffle: () => Promise<void>;
  callingNames?: boolean;
  onCallNames?: (teamA: QueueEntryView[], teamB: QueueEntryView[]) => void;
  onCancelCallNames?: () => void;
};

type TeamPreview = { teamA: QueueEntryView[]; teamB: QueueEntryView[] };

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomTeamSplit(pool: QueueEntryView[]): TeamPreview {
  const shuffled = shuffleArray(pool);
  return { teamA: shuffled.slice(0, 2), teamB: shuffled.slice(2, 4) };
}

function playerInitials(firstName: string, lastName: string) {
  const name = formatPlayerDisplayName(firstName, lastName);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

const FillCourtPlayerRow = memo(function FillCourtPlayerRow({
  entry,
  queueIndex,
  canReplace,
  onReplace,
  replacePending,
  obscured,
}: {
  entry: QueueEntryView;
  queueIndex: number;
  canReplace: boolean;
  onReplace: () => void;
  replacePending: boolean;
  obscured: boolean;
}) {
  const name = formatPlayerDisplayName(
    entry.playerId.firstName,
    entry.playerId.lastName,
    queueIndex + 1,
  );
  const photoUrl = useMemo(
    () => resolvePlayerPhotoUrl(entry.playerId, 72),
    [entry.playerId],
  );
  const initials = playerInitials(entry.playerId.firstName, entry.playerId.lastName);

  return (
    <li
      className={cn(
        "fill-court-player-row flex items-center gap-2 transition-[filter,opacity,transform] duration-150",
        obscured && "fill-court-player-row--obscured",
      )}
    >
      <Avatar
        size="sm"
        className={cn(
          "player-avatar !size-9 shrink-0 sm:!size-9",
          obscured && "fill-court-player-avatar--obscured",
        )}
      >
        <AvatarImage src={photoUrl} alt="" loading="lazy" />
        <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
      </Avatar>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium",
          obscured && "fill-court-player-name--obscured",
        )}
      >
        {name}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fill-court-replace-btn shrink-0"
        onClick={onReplace}
        disabled={replacePending || !canReplace || obscured}
      >
        {replacePending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <>
            <ArrowLeftRight className="mr-1 h-3.5 w-3.5" aria-hidden />
            Replace
          </>
        )}
      </Button>
    </li>
  );
});

function FillCourtTeamSection({
  label,
  entries,
  queueIndexOffset,
  canReplace,
  onReplace,
  replacePendingSourceIndex,
  obscured,
}: {
  label: string;
  entries: QueueEntryView[];
  queueIndexOffset: number;
  canReplace: boolean;
  onReplace: (sourceIndex: number, sourceEntry: QueueEntryView) => void;
  replacePendingSourceIndex: number | null;
  obscured: boolean;
}) {
  return (
    <div
      className={cn(
        "fill-court-team-section surface-muted flex flex-col gap-2 rounded-xl border p-3 transition-[box-shadow,border-color] duration-300",
        obscured && "fill-court-team-section--obscured",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="flex flex-col gap-2">
        {entries.map((entry, offset) => {
          const queueIndex = queueIndexOffset + offset;
          return (
            <FillCourtPlayerRow
              key={`${queueIndex}-${entry._id}`}
              entry={entry}
              queueIndex={queueIndex}
              canReplace={canReplace}
              onReplace={() => onReplace(queueIndex, entry)}
              replacePending={replacePendingSourceIndex === queueIndex}
              obscured={obscured}
            />
          );
        })}
      </ul>
    </div>
  );
}

export function FillCourtConfirmDialog({
  open,
  onOpenChange,
  courtNumber,
  teamA,
  teamB,
  canReplace,
  onReplace,
  replacePendingSourceIndex,
  onConfirmFill,
  fillPending = false,
  onShuffle,
  callingNames = false,
  onCallNames,
  onCancelCallNames,
}: FillCourtConfirmDialogProps) {
  const [isShuffling, setIsShuffling] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [preview, setPreview] = useState<TeamPreview | null>(null);
  const shuffleRunId = useRef(0);

  const canShuffle = teamA.length + teamB.length >= 4;
  const actionsDisabled = fillPending || isShuffling;
  const courtLabel = courtNumber != null ? `Court ${courtNumber}` : "the next court";
  const obscured = isShuffling;
  const displayTeamA = isShuffling && preview ? preview.teamA : teamA;
  const displayTeamB = isShuffling && preview ? preview.teamB : teamB;

  useEffect(() => {
    if (!open) {
      shuffleRunId.current += 1;
      setIsShuffling(false);
      setIsRevealing(false);
      setPreview(null);
    }
  }, [open]);

  const handleShuffleClick = useCallback(async () => {
    const pool = [...teamA, ...teamB];
    if (pool.length < 4 || isShuffling) return;

    const runId = shuffleRunId.current + 1;
    shuffleRunId.current = runId;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? 0 : SHUFFLE_DURATION_MS;

    setIsShuffling(true);
    setIsRevealing(false);
    setPreview(randomTeamSplit(pool));

    const tickInterval =
      duration > 0
        ? window.setInterval(() => {
            if (shuffleRunId.current !== runId) return;
            setPreview(randomTeamSplit(pool));
          }, SHUFFLE_TICK_MS)
        : undefined;

    try {
      await Promise.all([onShuffle(), new Promise<void>((resolve) => setTimeout(resolve, duration))]);
    } catch {
      if (shuffleRunId.current === runId) {
        setPreview(null);
        setIsShuffling(false);
        setIsRevealing(false);
      }
      return;
    } finally {
      if (tickInterval != null) window.clearInterval(tickInterval);
    }

    if (shuffleRunId.current !== runId) return;

    setPreview(null);
    setIsShuffling(false);

    if (duration > 0) {
      setIsRevealing(true);
      window.setTimeout(() => {
        if (shuffleRunId.current === runId) setIsRevealing(false);
      }, SHUFFLE_REVEAL_MS);
    }
  }, [isShuffling, onShuffle, teamA, teamB]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fill-court-confirm-dialog flex w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Play className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Fill {courtLabel}?
          </DialogTitle>
          <p className="caption text-left text-muted-foreground">
            These four players will start on {courtLabel}. Shuffle teams, replace anyone, then
            confirm.
          </p>
        </DialogHeader>

        <div
          className={cn(
            "fill-court-teams relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4",
            isShuffling && "fill-court-teams--shuffling",
            isRevealing && "fill-court-teams--reveal",
          )}
          aria-busy={isShuffling}
          aria-live="polite"
        >
          {isShuffling ? (
            <p className="fill-court-shuffle-status caption text-center font-medium text-primary">
              Shuffling teams…
            </p>
          ) : null}

          <FillCourtTeamSection
            label="Team A"
            entries={displayTeamA}
            queueIndexOffset={0}
            canReplace={canReplace && !actionsDisabled}
            onReplace={onReplace}
            replacePendingSourceIndex={replacePendingSourceIndex}
            obscured={obscured}
          />

          <div
            className={cn(
              "fill-court-shuffle-row relative flex flex-col items-center gap-1 py-0.5",
              isShuffling && "fill-court-shuffle-row--active",
            )}
          >
            {isShuffling ? (
              <span className="fill-court-roulette-ring pointer-events-none" aria-hidden />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "fill-court-shuffle-btn relative z-10 size-9 shrink-0",
                isShuffling && "fill-court-shuffle-btn--spinning",
              )}
              aria-label="Shuffle players into new teams"
              title="Shuffle teams (re-roll until it looks right)"
              disabled={!canShuffle || actionsDisabled}
              onClick={() => void handleShuffleClick()}
            >
              <Shuffle className="h-4 w-4" aria-hidden />
            </Button>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              VS
            </span>
          </div>

          <FillCourtTeamSection
            label="Team B"
            entries={displayTeamB}
            queueIndexOffset={2}
            canReplace={canReplace && !actionsDisabled}
            onReplace={onReplace}
            replacePendingSourceIndex={replacePendingSourceIndex}
            obscured={obscured}
          />
        </div>

        <DialogFooter className="!mx-0 !mb-0 mt-0 shrink-0 !flex-row items-center justify-between gap-2 rounded-none border-t border-border bg-muted/30 px-5 py-4 sm:gap-3">
          <Button
            type="button"
            className={cn(
              "call-names-btn h-11 min-w-0 flex-1 px-3 text-sm tracking-wide sm:min-w-[11rem] sm:flex-none sm:px-5",
              callingNames && "call-names-btn--calling",
              callingNames && "call-names-btn--cancel",
              courtNumber != null && !callingNames && "call-names-btn--glow",
            )}
            onClick={() => {
              if (callingNames) {
                onCancelCallNames?.();
                return;
              }
              onCallNames?.(displayTeamA, displayTeamB);
            }}
            disabled={
              !onCallNames ||
              actionsDisabled ||
              (!callingNames && displayTeamA.length + displayTeamB.length === 0)
            }
            aria-label={callingNames ? "Cancel call names" : "Call player names aloud"}
          >
            {callingNames ? (
              <VolumeX className="call-names-btn-icon mr-2 h-4 w-4" aria-hidden />
            ) : (
              <Volume2 className="call-names-btn-icon mr-2 h-4 w-4" aria-hidden />
            )}
            {callingNames ? "Cancel" : "Call Names"}
          </Button>
          <Button
            type="button"
            className="h-11 min-w-0 flex-1 sm:w-auto sm:flex-none"
            disabled={actionsDisabled || !canShuffle}
            onClick={onConfirmFill}
          >
            {fillPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Confirming…
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" aria-hidden />
                Confirm
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
