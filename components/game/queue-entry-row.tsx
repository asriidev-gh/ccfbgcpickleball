import { Clock, Share2 } from "lucide-react";
import type { ReactNode } from "react";

import { formatRelativeTimeForCard } from "@/lib/format-relative-time";

import { PlayerNameWithPhoto, resolvePlayerId, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { FirstTimerPill } from "@/components/game/leaderboard-standings";
import { PlayerEndorsementStatusBadge } from "@/components/game/player-endorsement-status-badge";
import { PlayerGenderPill } from "@/components/game/player-gender-pill";
import { QueuePlayerActionsMenu } from "@/components/game/queue-player-actions-menu";
import { UndefeatedBadge } from "@/components/game/undefeated-badge";
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

function NextOnCourtSessionRecordBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="badge-next-up-record whitespace-nowrap tabular-nums"
      aria-label={`Session record ${label}`}
    >
      {label}
    </Badge>
  );
}

function QueueEntrySessionStatsRow({
  sessionRecordLabel,
  showUndefeated,
  onUndefeatedClick,
  className,
}: {
  sessionRecordLabel: string;
  showUndefeated: boolean;
  onUndefeatedClick?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("queue-entry-session-stats flex flex-wrap items-center gap-1", className)}>
      {showUndefeated ? <UndefeatedBadge onClick={onUndefeatedClick} /> : null}
      <NextOnCourtSessionRecordBadge label={sessionRecordLabel} />
    </div>
  );
}

function formatLastMatchResult(result: QueueEntryView["lastMatchResult"]) {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  return "None";
}

function QueueEntryStatusDivider() {
  return <span className="queue-entry-status__divider" aria-hidden />;
}

function QueueEntryStatusLine({
  primaryLabel,
  lastMatchResult,
  sessionRecordLabel,
}: {
  primaryLabel: string;
  lastMatchResult: QueueEntryView["lastMatchResult"];
  sessionRecordLabel: string;
}) {
  const lastMatchLabel = formatLastMatchResult(lastMatchResult);

  return (
    <div
      className="queue-entry-status"
      aria-label={`${primaryLabel}. Last match: ${lastMatchLabel}. Session record ${sessionRecordLabel}.`}
    >
      <span className="queue-entry-status__segment queue-entry-status__wait">
        <Clock className="queue-entry-status__icon" aria-hidden />
        <span>{primaryLabel}</span>
      </span>
      <QueueEntryStatusDivider />
      <span
        className={cn(
          "queue-entry-status__segment queue-entry-status__last-match",
          lastMatchResult === "win" && "queue-entry-status__last-match--win",
          lastMatchResult === "loss" && "queue-entry-status__last-match--loss",
        )}
      >
        <span className="queue-entry-status__label">Last match</span>
        <span className="queue-entry-status__value">{lastMatchLabel}</span>
      </span>
      <QueueEntryStatusDivider />
      <span className="queue-entry-status__record hidden xl:inline-flex">
        <NextOnCourtSessionRecordBadge label={sessionRecordLabel} />
      </span>
    </div>
  );
}

function SharedStatusBadge({
  onClick,
  className,
}: {
  onClick?: () => void;
  className?: string;
}) {
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
        onClick && "cursor-pointer transition-colors hover:bg-sky-500/20",
        className,
      )}
      aria-label="Player card shared by spectator"
    >
      <Share2 className="mr-1 size-3 shrink-0" aria-hidden />
      Shared
    </Badge>
  );

  if (!onClick) return badge;

  return (
    <button
      type="button"
      className="inline-flex"
      onClick={onClick}
      aria-label="View shared player card preview"
    >
      {badge}
    </button>
  );
}

function QueueSessionStatsBadges({
  wins,
  losses,
  rank,
  showLeaderboardRank = false,
  hideRecordOnLargeScreens = false,
  onUndefeatedClick,
  className,
}: {
  wins: number;
  losses: number;
  rank?: number | null;
  showLeaderboardRank?: boolean;
  hideRecordOnLargeScreens?: boolean;
  onUndefeatedClick?: () => void;
  className?: string;
}) {
  const stats = { wins, losses, gamesPlayed: wins + losses };
  const showUndefeated = isSessionUndefeated(stats);
  const recordLabel = showLeaderboardRank
    ? formatSessionRecordWithRankLabel(stats, rank)
    : formatSessionRecordLabel(stats);

  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-1", className)}>
      {showUndefeated ? <UndefeatedBadge onClick={onUndefeatedClick} /> : null}
      <Badge
        variant="outline"
        className={cn(
          "whitespace-nowrap tabular-nums",
          hideRecordOnLargeScreens && "xl:hidden",
        )}
      >
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
  endorsementCount = 0,
  onEndorsementClick,
}: {
  entry: QueueEntryView;
  compactName: boolean;
  checkedOut: boolean;
  slot: number;
  endorsementCount?: number;
  onEndorsementClick?: () => void;
}) {
  const rank = checkedOut ? undefined : slot;
  const name = compactName
    ? formatPlayerCourtName(entry.playerId.firstName, entry.playerId.lastName, rank)
    : formatPlayerDisplayName(entry.playerId.firstName, entry.playerId.lastName, rank);

  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <span className="min-w-0 truncate">{name}</span>
      <PlayerGenderPill gender={entry.playerId.gender} birthdate={entry.playerId.birthdate} />
      {entry.isFirstTimer ? <FirstTimerPill /> : null}
      {endorsementCount > 0 ? (
        <PlayerEndorsementStatusBadge count={endorsementCount} onClick={onEndorsementClick} />
      ) : null}
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
  /** Show compact (W/L/R) under the name in split next-on-court layout. */
  showSessionRecordBelowName?: boolean;
  /** Replace the Next on court pill with (W/L/R) in stacked layout. */
  showSessionRecordInPillSlot?: boolean;
  /** When set, superadmins can open this player's spectate view. */
  gameId?: string;
  allowCheckInAsPlayer?: boolean;
  showLeaderboardRank?: boolean;
  leaderboardRankMap?: Map<string, number>;
  /** Spectator queue: open player info card. */
  onViewPlayerInfo?: () => void;
  /** Organizer queue: show when a spectator shared this player's card. */
  showCardSharedStatus?: boolean;
  onSharedClick?: () => void;
  /** Organizer queue: show when other players endorsed this player. */
  showEndorsementStatus?: boolean;
  /** Spectator queue: show endorsement badge beside the player name. */
  showEndorsementInPlayerLabel?: boolean;
  endorsementCount?: number;
  onEndorsementClick?: () => void;
  /** Open this player's session match history (undefeated badge). */
  onUndefeatedClick?: () => void;
  /** Spectator self row: share player card action beside checkout. */
  shareAction?: ReactNode;
  /** Spectator: endorse another player in the queue. */
  endorseAction?: ReactNode;
  /** Hide replace / checkout / share actions for a denser queue list. */
  hideActions?: boolean;
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
  showSessionRecordBelowName = false,
  showSessionRecordInPillSlot = false,
  gameId,
  allowCheckInAsPlayer = true,
  showLeaderboardRank = false,
  leaderboardRankMap,
  onViewPlayerInfo,
  showCardSharedStatus = false,
  onSharedClick,
  onUndefeatedClick,
  showEndorsementStatus = false,
  showEndorsementInPlayerLabel = false,
  endorsementCount = 0,
  onEndorsementClick,
  shareAction,
  endorseAction,
  hideActions = false,
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
  const sharedBadge = showSharedStatus ? (
    <SharedStatusBadge onClick={onSharedClick} />
  ) : null;
  const showEndorsedInPlayerLabel = showEndorsementInPlayerLabel && endorsementCount > 0;
  const showEndorsedStatus = showEndorsementStatus && endorsementCount > 0 && !showEndorsedInPlayerLabel;
  const endorsedBadge = showEndorsedStatus ? (
    <PlayerEndorsementStatusBadge count={endorsementCount} onClick={onEndorsementClick} />
  ) : null;
  const undefeatedBadge = showUndefeated ? (
    <UndefeatedBadge onClick={onUndefeatedClick} />
  ) : null;
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
    (checkedOut && Boolean(onCheckBackIn)) ||
    Boolean(shareAction) ||
    Boolean(endorseAction);

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
          {!dragHandle && !checkedOut ? (
            <span className="queue-rank" aria-label={`Queue position ${slot}`}>
              {slot}
            </span>
          ) : null}
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
                  endorsementCount={showEndorsedInPlayerLabel ? endorsementCount : 0}
                  onEndorsementClick={showEndorsedInPlayerLabel ? onEndorsementClick : undefined}
                />
              </PlayerNameWithPhoto>
              {!checkedOut && !hideSessionStats ? (
                <QueueEntrySessionStatsRow
                  sessionRecordLabel={sessionRecordLabel}
                  showUndefeated={showUndefeated}
                  onUndefeatedClick={onUndefeatedClick}
                  className="mt-1 xl:hidden"
                />
              ) : null}
              {isNextUp && showSessionRecordBelowName && !hideSessionStats ? (
                <QueueEntrySessionStatsRow
                  sessionRecordLabel={sessionRecordLabel}
                  showUndefeated={false}
                  className="queue-next-up-inline-record mt-1 hidden xl:flex"
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 xl:flex-row xl:items-center">
          {checkedOut ? null : isNextUp ? (
            <>
              {sharedBadge ? <span className="xl:hidden">{sharedBadge}</span> : null}
              {endorsedBadge ? <span className="xl:hidden">{endorsedBadge}</span> : null}
              <div className="hidden items-center gap-1.5 xl:flex">
                {sharedBadge}
                {endorsedBadge}
                {undefeatedBadge}
                {showSessionRecordInPillSlot ? (
                  <NextOnCourtSessionRecordBadge label={sessionRecordLabel} />
                ) : showSessionRecordBelowName ? null : (
                  <Badge className="badge-next-up" aria-label="Next on court">
                    <NextOnCourtLabel />
                  </Badge>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {sharedBadge}
              {endorsedBadge}
              {!hideSessionStats ? (
                <QueueSessionStatsBadges
                  wins={sessionStats.wins}
                  losses={sessionStats.losses}
                  rank={leaderboardRank}
                  showLeaderboardRank={showLeaderboardRank}
                  hideRecordOnLargeScreens
                  onUndefeatedClick={onUndefeatedClick}
                  className="hidden xl:flex"
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "queue-entry-meta",
          isNextUp && "queue-entry-meta--next-up",
          inWaitingLine && "queue-entry-meta--waiting-line",
          checkedOut && "text-muted-foreground/90",
        )}
        suppressHydrationWarning
      >
        {checkedOut && checkedOutTime ? (
          <QueueEntryStatusLine
            primaryLabel={`Checked out ${formatRelativeTimeForCard(checkedOutTime, { addSuffix: true })}`}
            lastMatchResult={entry.lastMatchResult}
            sessionRecordLabel={sessionRecordLabel}
          />
        ) : (
          <QueueEntryStatusLine
            primaryLabel={`Waiting for ${formatRelativeTimeForCard(new Date(entry.registeredAt))}`}
            lastMatchResult={entry.lastMatchResult}
            sessionRecordLabel={sessionRecordLabel}
          />
        )}
      </div>

      {(showActionsMenu || shareAction || endorseAction) && !hideActions ? (
        <div
          className={cn(
            showReplace ? "queue-swap-panel" : "mt-2",
            "flex flex-wrap justify-end gap-1 xl:gap-2",
          )}
        >
          {endorseAction}
          {shareAction}
          {showActionsMenu ? (
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
