import { ArrowLeftRight, LogIn, LogOut, Trophy } from "lucide-react";
import type { ReactNode } from "react";

import { formatRelativeTimeForCard } from "@/lib/format-relative-time";

import { PlayerNameWithPhoto, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatSessionRecordLabel,
  isSessionUndefeated,
} from "@/lib/games-played-map";
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
      <span className="xl:hidden">Next</span>
      <span className="hidden xl:inline">Next on court</span>
    </>
  );
}

function formatLastMatchResult(result: QueueEntryView["lastMatchResult"]) {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  return "None";
}

function UndefeatedBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("queue-undefeated-badge whitespace-nowrap", className)}
      aria-label="Undefeated — 3 or more wins, no losses"
    >
      <Trophy className="queue-undefeated-badge-icon" aria-hidden />
      <span className="queue-undefeated-badge-text">Undefeated</span>
    </Badge>
  );
}

function QueueSessionStatsBadges({
  wins,
  losses,
  className,
}: {
  wins: number;
  losses: number;
  className?: string;
}) {
  const stats = { wins, losses, gamesPlayed: wins + losses };
  const showUndefeated = isSessionUndefeated(stats);

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-1", className)}>
      {showUndefeated ? <UndefeatedBadge /> : null}
      <Badge variant="outline" className="whitespace-nowrap tabular-nums">
        {formatSessionRecordLabel(stats)}
      </Badge>
    </div>
  );
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
  /** Pulse highlight after self-registration (Proceed to game queue). */
  highlighted?: boolean;
  /** Waiting in line section (not next on court) — no left accent bar. */
  inWaitingLine?: boolean;
  /** Operator drag handle for reordering queue position. */
  dragHandle?: ReactNode;
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
  highlighted = false,
  inWaitingLine = false,
  dragHandle,
}: QueueEntryRowProps) {
  const slot = index + 1;
  const checkedOutTime = entry.checkedOutAt ? new Date(entry.checkedOutAt) : null;
  const sessionStats = {
    gamesPlayed: entry.gamesPlayed ?? 0,
    wins: entry.wins ?? 0,
    losses: entry.losses ?? 0,
  };
  const sessionRecordLabel = formatSessionRecordLabel(sessionStats);
  const showUndefeated = isSessionUndefeated(sessionStats);
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
    <div
      id={`queue-entry-${entry._id}`}
      className={cn(
        "queue-item rounded-xl border p-2.5 xl:p-3",
        isNextUp && "queue-next-up--compact",
        rowClass,
        inWaitingLine && "queue-waiting-line",
        highlighted && "queue-entry-highlighted",
      )}
    >
      {isNextUp ? <span className="queue-slot-ribbon" aria-hidden /> : null}

      <div className="queue-item-layout flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 xl:gap-3">
          {dragHandle}
          {checkedOut ? null : (
          <span className="queue-rank" aria-label={`Queue position ${slot}`}>
            {slot}
          </span>
          )}
          <div className="min-w-0 flex-1">
            <div className={cn("min-w-0", isNextUp ? "text-sm font-medium xl:text-base" : "body-lg")}>
              <PlayerNameWithPhoto
                player={entry.playerId}
                className={cn(
                  isNextUp && "gap-2 xl:gap-3",
                  checkedOut && "opacity-80",
                )}
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
        <div className="flex shrink-0 flex-col items-end gap-1.5 xl:flex-row xl:items-center">
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
            <>
              <QueueSessionStatsBadges
                wins={sessionStats.wins}
                losses={sessionStats.losses}
                className="xl:hidden"
              />
              <div className="hidden items-center gap-1.5 xl:flex">
                {showUndefeated ? <UndefeatedBadge /> : null}
                <Badge className="badge-next-up" aria-label="Next on court">
                  <NextOnCourtLabel />
                </Badge>
              </div>
            </>
          ) : (
            <QueueSessionStatsBadges wins={sessionStats.wins} losses={sessionStats.losses} />
          )}
        </div>
      </div>

      <p
        className={cn(
          "queue-entry-meta",
          isNextUp && "queue-entry-meta--next-up",
          checkedOut && "text-muted-foreground/90",
        )}
        suppressHydrationWarning
      >
        {checkedOut && checkedOutTime ? (
          <>
            Checked out {formatRelativeTimeForCard(checkedOutTime, { addSuffix: true })} | Last match:{" "}
            {formatLastMatchResult(entry.lastMatchResult)} | {sessionRecordLabel}
            {showUndefeated ? <UndefeatedBadge className="ml-1 align-middle" /> : null}
          </>
        ) : (
          <>
            Waiting for {formatRelativeTimeForCard(new Date(entry.registeredAt))} | Last match:{" "}
            {formatLastMatchResult(entry.lastMatchResult)}
            {!inWaitingLine ? ` | ${sessionRecordLabel}` : ""}
          </>
        )}
      </p>

      {!checkedOut && isNextUp && !hideReplacePanel ? (
        <div className="queue-swap-panel">
          <div className="flex flex-wrap justify-end gap-1 xl:gap-2">
            <Button
              size="sm"
              variant="outline"
              className="queue-replace-btn h-7 min-h-7 gap-0.5 px-2 text-[11px] leading-tight xl:h-9 xl:min-h-9 xl:px-3 xl:text-sm"
              onClick={onReplace}
              disabled={replacePending || !canReplace}
            >
              <ArrowLeftRight className="size-3 shrink-0 xl:size-3.5" />
              Replace
            </Button>
            {onRemove ? (
              <Button
                size="sm"
                variant="outline"
                className="queue-remove-btn h-7 min-h-7 gap-0.5 border-destructive/50 px-2 text-[11px] leading-tight text-destructive xl:h-9 xl:min-h-9 xl:px-3 xl:text-sm"
                onClick={onRemove}
                disabled={removePending}
              >
                <LogOut className="size-3 shrink-0 xl:size-3.5" />
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
