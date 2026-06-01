import { ArrowLeftRight, LogIn, LogOut } from "lucide-react";

import { formatRelativeTimeForCard } from "@/lib/format-relative-time";

import { PlayerNameWithPhoto, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSessionRecordLabel } from "@/lib/games-played-map";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type QueueEntryView = {
  _id: string;
  queueType: "normal" | "winner" | "loser";
  playerId: PlayerPhotoRef;
  registeredAt: string;
  lastMatchResult: "win" | "loss" | "none";
  /** Set when the player checked out of the waiting queue. */
  checkedOutAt?: string;
  updatedAt?: string;
  /** Session stats from leaderboard (this open play). */
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
};

function NextOnCourtLabel() {
  return (
    <>
      <span className="sm:hidden">Next</span>
      <span className="hidden sm:inline">Next on court</span>
    </>
  );
}

function formatLastMatchResult(result: QueueEntryView["lastMatchResult"]) {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  return "None";
}

type QueueEntryRowProps = {
  entry: QueueEntryView;
  index: number;
  isNextUp: boolean;
  canReplace?: boolean;
  onReplace: () => void;
  replacePending: boolean;
  hideReplacePanel?: boolean;
  onRemove?: () => void;
  removePending?: boolean;
  /** Read-only row for players who left the waiting queue. */
  checkedOut?: boolean;
  onCheckBackIn?: () => void;
  checkBackInPending?: boolean;
};

export function QueueEntryRow({
  entry,
  index,
  isNextUp,
  canReplace = false,
  onReplace,
  replacePending,
  hideReplacePanel = false,
  onRemove,
  removePending = false,
  checkedOut = false,
  onCheckBackIn,
  checkBackInPending = false,
}: QueueEntryRowProps) {
  const slot = index + 1;
  const checkedOutTime = entry.checkedOutAt ? new Date(entry.checkedOutAt) : null;
  const sessionRecordLabel = formatSessionRecordLabel({
    gamesPlayed: entry.gamesPlayed ?? 0,
    wins: entry.wins ?? 0,
    losses: entry.losses ?? 0,
  });
  const rowClass = checkedOut
    ? "queue-checked-out"
    : isNextUp
    ? `queue-next-up queue-next-up-slot-${slot}`
    : entry.queueType === "winner"
      ? "queue-winner"
      : entry.queueType === "loser"
        ? "queue-loser"
        : "queue-item-default border-border bg-muted/50";

  return (
    <div className={cn("queue-item rounded-xl border p-3", rowClass)}>
      {isNextUp ? <span className="queue-slot-ribbon" aria-hidden /> : null}

      <div className="queue-item-layout flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {checkedOut ? null : (
          <span className="queue-rank" aria-label={`Queue position ${slot}`}>
            {slot}
          </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="body-lg min-w-0">
              <PlayerNameWithPhoto
                player={entry.playerId}
                className={checkedOut ? "opacity-80" : undefined}
                nameClassName={checkedOut ? "text-muted-foreground" : undefined}
              >
                {formatPlayerDisplayName(
                  entry.playerId.firstName,
                  entry.playerId.lastName,
                  checkedOut ? undefined : slot,
                )}
              </PlayerNameWithPhoto>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          {checkedOut && onCheckBackIn ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="queue-check-back-in-btn"
              onClick={onCheckBackIn}
              disabled={checkBackInPending}
            >
              <LogIn className="mr-1.5 h-3.5 w-3.5" />
              {checkBackInPending ? "Checking in…" : "Check back in"}
            </Button>
          ) : checkedOut ? null : isNextUp ? (
            <Badge className="badge-next-up" aria-label="Next on court">
              <NextOnCourtLabel />
            </Badge>
          ) : (
            <Badge variant="outline">{entry.queueType}</Badge>
          )}
        </div>
      </div>

      <p
        className={cn("queue-entry-meta", checkedOut && "text-muted-foreground/90")}
        suppressHydrationWarning
      >
        {checkedOut && checkedOutTime ? (
          <>
            Checked out {formatRelativeTimeForCard(checkedOutTime, { addSuffix: true })} | Last match:{" "}
            {formatLastMatchResult(entry.lastMatchResult)} | {sessionRecordLabel}
          </>
        ) : (
          <>
            Waiting for {formatRelativeTimeForCard(new Date(entry.registeredAt))} | Last match:{" "}
            {formatLastMatchResult(entry.lastMatchResult)} | {sessionRecordLabel}
          </>
        )}
      </p>

      {!checkedOut && isNextUp && !hideReplacePanel ? (
        <div className="queue-swap-panel">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="queue-replace-btn"
              onClick={onReplace}
              disabled={replacePending || !canReplace}
            >
              <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
              Replace
            </Button>
            {onRemove ? (
              <Button
                size="sm"
                variant="outline"
                className="queue-remove-btn border-destructive/50 text-destructive"
                onClick={onRemove}
                disabled={removePending}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Check Out
              </Button>
            ) : null}
          </div>
        </div>
      ) : !checkedOut && onRemove ? (
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="queue-remove-btn border-destructive/50 text-destructive"
            onClick={onRemove}
            disabled={removePending}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Check Out
          </Button>
        </div>
      ) : null}
    </div>
  );
}
