import { Trophy, Share2 } from "lucide-react";
import type { ReactNode } from "react";

import { formatRelativeTimeForCard } from "@/lib/format-relative-time";

import { PlayerNameWithPhoto, resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { FirstTimerPill } from "@/components/game/leaderboard-standings";
import { QueuePlayerActionsMenu } from "@/components/game/queue-player-actions-menu";
import { Badge } from "@/components/ui/badge";
import {
  formatSessionRecordLabel,
  formatSessionRecordWithRankLabel,
  getPlayerLeaderboardRank,
  isSessionUndefeated,
} from "@/lib/games-played-map";
import { cn, formatPlayerCourtName, formatPlayerDisplayName } from "@/lib/utils";

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
  /** First ended-session record with this club owner before this open play. */
  isFirstTimer?: boolean;
  /** Set when a spectator shared this player's stats card. */
  cardSharedAt?: string;
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

function SharedStatusBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
        className,
      )}
      aria-label="Player card shared by spectator"
    >
      <Share2 className="mr-1 size-3 shrink-0" aria-hidden />
      Shared
    </Badge>
  );
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
  rank,
  showLeaderboardRank = false,
  className,
}: {
  wins: number;
  losses: number;
  rank?: number | null;
  showLeaderboardRank?: boolean;
  className?: string;
}) {
  const stats = { wins, losses, gamesPlayed: wins + losses };
  const showUndefeated = isSessionUndefeated(stats);
  const recordLabel = showLeaderboardRank
    ? formatSessionRecordWithRankLabel(stats, rank)
    : formatSessionRecordLabel(stats);

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-1", className)}>
      {showUndefeated ? <UndefeatedBadge /> : null}
      <Badge variant="outline" className="whitespace-nowrap tabular-nums">
        {recordLabel}
      </Badge>
    </div>
  );
}

function QueuePlayerLabel({
  entry,
  compactName,
  checkedOut,
  slot,
}: {
  entry: QueueEntryView;
  compactName: boolean;
  checkedOut: boolean;
  slot: number;
}) {
  const rank = checkedOut ? undefined : slot;
  const name = compactName
    ? formatPlayerCourtName(entry.playerId.firstName, entry.playerId.lastName, rank)
    : formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName, rank);

  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <span className="min-w-0 truncate">{name}</span>
      {entry.isFirstTimer ? <FirstTimerPill /> : null}
    </span>
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
  onRemovePlayer?: () => void;
  removePlayerPending?: boolean;
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
  /** First name + last initial (e.g. "Alex M.") for dense layouts. */
  compactName?: boolean;
  /** Hide win/loss badges (e.g. compact group view). */
  hideSessionStats?: boolean;
  /** When set, superadmins can open this player's spectate view. */
  gameId?: string;
  allowCheckInAsPlayer?: boolean;
  showLeaderboardRank?: boolean;
  leaderboardRankMap?: Map<string, number>;
  /** Spectator queue: open player info card. */
  onViewPlayerInfo?: () => void;
  /** Organizer queue: show when a spectator shared this player's card. */
  showCardSharedStatus?: boolean;
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
  onRemovePlayer,
  removePlayerPending = false,
  checkedOut = false,
  onCheckBackIn,
  checkBackInPending = false,
  highlighted = false,
  inWaitingLine = false,
  dragHandle,
  compactName = false,
  hideSessionStats = false,
  gameId,
  allowCheckInAsPlayer = true,
  showLeaderboardRank = false,
  leaderboardRankMap,
  onViewPlayerInfo,
  showCardSharedStatus = false,
}: QueueEntryRowProps) {
  const slot = index + 1;
  const playerMongoId = resolvePlayerId(entry.playerId);
  const playerDisplayName = formatPlayerDisplayName(
    entry.playerId.firstName,
    entry.playerId.lastName,
  );
  const checkedOutTime = entry.checkedOutAt ? new Date(entry.checkedOutAt) : null;
  const sessionStats = {
    gamesPlayed: entry.gamesPlayed ?? 0,
    wins: entry.wins ?? 0,
    losses: entry.losses ?? 0,
  };
  const leaderboardRank =
    showLeaderboardRank && leaderboardRankMap
      ? getPlayerLeaderboardRank(leaderboardRankMap, entry.playerId)
      : null;
  const sessionRecordLabel = showLeaderboardRank
    ? formatSessionRecordWithRankLabel(sessionStats, leaderboardRank)
    : formatSessionRecordLabel(sessionStats);
  const showUndefeated = isSessionUndefeated(sessionStats);
  const showSharedStatus = showCardSharedStatus && Boolean(entry.cardSharedAt);
  const rowClass = checkedOut
    ? "queue-checked-out"
    : isNextUp
    ? `queue-next-up queue-next-up-slot-${slot}`
    : entry.queueType === "winner"
      ? "queue-winner"
      : entry.queueType === "loser"
        ? "queue-loser"
        : "queue-item-default border-border bg-muted/50";

  const showReplace = !checkedOut && isNextUp && !hideReplacePanel;
  const checkInAsPlayer =
    allowCheckInAsPlayer && gameId && playerMongoId
      ? { gameId, playerId: playerMongoId, playerName: playerDisplayName }
      : undefined;
  const showActionsMenu =
    showReplace ||
    Boolean(onRemove) ||
    Boolean(onRemovePlayer) ||
    (checkedOut && Boolean(onCheckBackIn));

  return (
    <div
      id={`queue-entry-${entry._id}`}
      className={cn(
        "queue-item rounded-xl border p-2.5 xl:p-3",
        isNextUp && "queue-next-up--compact",
        rowClass,
        inWaitingLine && "queue-waiting-line",
        compactName && "queue-item--compact-name",
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
                onPlayerClick={onViewPlayerInfo}
                className={cn(
                  isNextUp && "gap-2 xl:gap-3",
                  checkedOut && "opacity-80",
                )}
                nameClassName={checkedOut ? "text-muted-foreground" : undefined}
              >
                <QueuePlayerLabel
                  entry={entry}
                  compactName={compactName}
                  checkedOut={checkedOut}
                  slot={slot}
                />
              </PlayerNameWithPhoto>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 xl:flex-row xl:items-center">
          {checkedOut ? null : isNextUp ? (
            <>
              <QueueSessionStatsBadges
                wins={sessionStats.wins}
                losses={sessionStats.losses}
                rank={leaderboardRank}
                showLeaderboardRank={showLeaderboardRank}
                className="xl:hidden"
              />
              {showSharedStatus ? <SharedStatusBadge className="xl:hidden" /> : null}
              <div className="hidden items-center gap-1.5 xl:flex">
                {showSharedStatus ? <SharedStatusBadge /> : null}
                {showUndefeated ? <UndefeatedBadge /> : null}
                <Badge className="badge-next-up" aria-label="Next on court">
                  <NextOnCourtLabel />
                </Badge>
              </div>
            </>
          ) : hideSessionStats ? (
            showSharedStatus ? <SharedStatusBadge /> : null
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {showSharedStatus ? <SharedStatusBadge /> : null}
              <QueueSessionStatsBadges
                wins={sessionStats.wins}
                losses={sessionStats.losses}
                rank={leaderboardRank}
                showLeaderboardRank={showLeaderboardRank}
              />
            </div>
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

      {showActionsMenu ? (
        <div
          className={cn(
            showReplace ? "queue-swap-panel" : "mt-2",
            "flex flex-wrap justify-end gap-1 xl:gap-2",
          )}
        >
          <QueuePlayerActionsMenu
            onReplace={showReplace ? onReplace : undefined}
            canReplace={canReplace}
            replacePending={replacePending}
            onCheckBackIn={checkedOut ? onCheckBackIn : undefined}
            checkBackInPending={checkBackInPending}
            checkInAsPlayer={checkInAsPlayer}
            onCheckOut={onRemove}
            checkOutPending={removePending}
            onRemovePlayer={onRemovePlayer}
            removePlayerPending={removePlayerPending}
            compact={showReplace}
          />
        </div>
      ) : null}
    </div>
  );
}
