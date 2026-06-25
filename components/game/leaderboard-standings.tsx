import { Badge } from "@/components/ui/badge";
import { Clock, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { LeaderboardMedalIcon } from "@/components/game/leaderboard-medal-icon";
import { LeaderboardPodiumFrame } from "@/components/game/leaderboard-podium-frame";
import { SpectatorPlayerCardShareButton } from "@/components/game/spectator-player-card-share-button";
import { PlayerEndorsementStatusBadge } from "@/components/game/player-endorsement-status-badge";
import { PlayerAvatar, type PlayerPhotoRef } from "@/components/game/player-avatar";
import { UndefeatedBadge } from "@/components/game/undefeated-badge";
import { isSessionUndefeated } from "@/lib/games-played-map";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type LeaderboardRow = PlayerPhotoRef & {
  id: string;
  playerId?: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  isFirstTimer?: boolean;
};

function displayLabel(row: LeaderboardRow, rank: number) {
  return formatPlayerDisplayName(row.firstName, row.lastName, rank);
}

export function resolveLeaderboardPlayerId(row: LeaderboardRow) {
  return row.playerId ?? row.id;
}

type LeaderboardEndorsementProps = {
  endorsementCounts?: Record<string, number>;
  onEndorsementClick?: (row: LeaderboardRow) => void;
};

type LeaderboardPodiumShareProps = {
  onPodiumShareClick?: (row: LeaderboardRow) => void;
};

export function FirstTimerPill({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-0.5 whitespace-nowrap border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200",
        className,
      )}
      title="First session with this club"
      aria-label="1st timer — first session with this club"
    >
      1st
      <Clock className="size-3 shrink-0" aria-hidden />
    </Badge>
  );
}

function LeaderboardPlayerName({
  row,
  rank,
  align = "start",
  className,
  nameClassName,
  endorsementCounts,
  onEndorsementClick,
  hideUndefeated = false,
  pillsOnOwnRowFrom,
}: {
  row: LeaderboardRow;
  rank: number;
  align?: "start" | "center";
  className?: string;
  nameClassName?: string;
  hideUndefeated?: boolean;
  pillsOnOwnRowFrom?: "md" | "lg";
} & LeaderboardEndorsementProps) {
  const playerId = resolveLeaderboardPlayerId(row);
  const endorsementCount = endorsementCounts?.[playerId] ?? 0;
  const showUndefeated =
    !hideUndefeated && isSessionUndefeated({ wins: row.wins, losses: row.losses });
  const hasPills = row.isFirstTimer || showUndefeated || endorsementCount > 0;
  const stackMd = pillsOnOwnRowFrom === "md";
  const stackLg = pillsOnOwnRowFrom === "lg";

  return (
    <span
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1",
        stackMd && "md:flex-col md:gap-1",
        stackLg && "lg:flex-col lg:gap-1",
        align === "center"
          ? "justify-center"
          : cn("justify-start", stackMd && "md:items-start", stackLg && "lg:items-start"),
        stackMd && align === "center" && "md:items-center",
        stackLg && align === "center" && "lg:items-center",
        className,
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate",
          stackMd && align === "center" && "md:w-full md:text-center",
          stackLg && align === "center" && "lg:w-full lg:text-center",
          stackMd && align === "start" && "md:w-full",
          stackLg && align === "start" && "lg:w-full",
          nameClassName,
        )}
      >
        {displayLabel(row, rank)}
      </span>
      {hasPills ? (
        <span
          className={cn(
            "inline-flex flex-wrap items-center gap-1",
            align === "center" ? "justify-center" : "justify-start",
            stackMd && "md:w-full md:justify-center",
            stackLg && "lg:w-full lg:justify-center",
          )}
        >
          {row.isFirstTimer ? <FirstTimerPill /> : null}
          {showUndefeated ? <UndefeatedBadge className="leaderboard-undefeated-badge" /> : null}
          {endorsementCount > 0 ? (
            <PlayerEndorsementStatusBadge
              count={endorsementCount}
              onClick={onEndorsementClick ? () => onEndorsementClick(row) : undefined}
            />
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function RankDisplay({
  rank,
  size = "md",
  className,
}: {
  rank: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (rank === 1 || rank === 2 || rank === 3) {
    return (
      <span
        className={cn(
          "leaderboard-rank-medal inline-flex shrink-0 items-center justify-center",
          className,
        )}
      >
        <LeaderboardMedalIcon rank={rank as 1 | 2 | 3} size={size} />
      </span>
    );
  }
  return (
    <span
      className={cn("leaderboard-rank-badge leaderboard-rank-badge-default", className)}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak > 0) {
    return (
      <span className="leaderboard-streak leaderboard-streak-positive">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        {streak}W
      </span>
    );
  }
  if (streak < 0) {
    return (
      <span className="leaderboard-streak leaderboard-streak-negative">
        <TrendingDown className="h-3.5 w-3.5" aria-hidden />
        {Math.abs(streak)}L
      </span>
    );
  }
  return (
    <span className="leaderboard-streak leaderboard-streak-neutral">
      <Minus className="h-3.5 w-3.5" aria-hidden />
      —
    </span>
  );
}

function podiumAvatarClass(rank: 1 | 2 | 3, compact: boolean) {
  if (compact) {
    return cn(
      "leaderboard-podium-avatar",
      rank === 1 ? "leaderboard-podium-avatar--first-compact" : "leaderboard-podium-avatar--podium-compact",
    );
  }
  return cn(
    "leaderboard-podium-avatar",
    rank === 1 ? "leaderboard-podium-avatar--first" : "leaderboard-podium-avatar--podium",
  );
}

function podiumPlaceLabel(rank: 1 | 2 | 3) {
  return rank === 1 ? "1st Place" : rank === 2 ? "2nd Place" : "3rd Place";
}

function PodiumCard({
  row,
  rank,
  compact = false,
  endorsementCounts,
  onEndorsementClick,
  onPodiumShareClick,
}: {
  row: LeaderboardRow;
  rank: 1 | 2 | 3;
  compact?: boolean;
} & LeaderboardEndorsementProps &
  LeaderboardPodiumShareProps) {
  const podiumClass =
    rank === 1
      ? "leaderboard-podium-card-gold"
      : rank === 2
        ? "leaderboard-podium-card-silver"
        : "leaderboard-podium-card-bronze";
  const showUndefeated = isSessionUndefeated({ wins: row.wins, losses: row.losses });

  return (
    <LeaderboardPodiumFrame
      rank={rank}
      compact={compact}
      className={cn(
        rank === 1 && !compact && "leaderboard-podium-card--first md:-mt-3",
        rank === 2 && !compact && "leaderboard-podium-card--second md:pb-3.5",
        rank === 3 && !compact && "leaderboard-podium-card--third md:pb-3",
      )}
    >
      <article
        className={cn(
          "leaderboard-podium-card flex w-full min-w-0 flex-col items-center text-center",
          compact ? "leaderboard-podium-card--compact px-1.5 py-2" : "px-3 py-3 sm:px-4 sm:py-4",
          podiumClass,
          rank === 1 && !compact && "md:py-5",
        )}
      >
        <div className="leaderboard-podium-card__glow" aria-hidden />
        <p className="leaderboard-podium-card__place relative z-[1]">
          {podiumPlaceLabel(rank)}
        </p>
        <RankDisplay
          rank={rank}
          size={compact ? "sm" : "lg"}
          className="relative z-[1] mt-1"
        />
        <div
          className={cn(
            "relative z-[1] flex flex-col items-center",
            compact ? "mt-1 gap-1" : "mt-2 gap-2",
          )}
        >
          <PlayerAvatar
            player={row}
            className={cn("leaderboard-podium-avatar shrink-0", podiumAvatarClass(rank, compact))}
          />
          {showUndefeated ? (
            <div className="leaderboard-podium-undefeated flex w-full justify-center">
              <UndefeatedBadge className="leaderboard-undefeated-badge" />
            </div>
          ) : null}
        </div>
        <p
          className={cn(
            "relative z-[1] w-full leading-tight",
            compact ? "mt-1 px-0.5" : showUndefeated ? "mt-1.5 px-1" : "mt-2 px-1",
          )}
        >
          <LeaderboardPlayerName
            row={row}
            rank={rank}
            align="center"
            hideUndefeated
            pillsOnOwnRowFrom={compact ? undefined : "lg"}
            nameClassName={cn("font-semibold", compact ? "text-[11px]" : "body-lg")}
            endorsementCounts={endorsementCounts}
            onEndorsementClick={onEndorsementClick}
          />
        </p>
        <div
          className={cn(
            "leaderboard-podium-stats relative z-[1] mt-2 grid w-full max-w-[8.5rem] grid-cols-2 gap-px overflow-hidden rounded-lg",
            compact ? "mt-1.5 max-w-full" : "mt-3",
          )}
        >
          <div className="leaderboard-podium-stats__cell flex flex-col items-center px-1 py-1.5 sm:py-2">
            <span
              className={cn(
                "stat-num font-bold tabular-nums text-emerald-600 dark:text-emerald-400",
                compact ? "text-sm" : "text-lg sm:text-xl",
              )}
            >
              {row.wins}
            </span>
            <span
              className={cn(
                "font-medium uppercase tracking-wide text-muted-foreground",
                compact ? "text-[9px]" : "text-[10px] sm:text-xs",
              )}
            >
              Wins
            </span>
          </div>
          <div className="leaderboard-podium-stats__cell flex flex-col items-center px-1 py-1.5 sm:py-2">
            <span
              className={cn(
                "font-semibold tabular-nums text-muted-foreground",
                compact ? "text-sm" : "text-base sm:text-lg",
              )}
            >
              {row.losses}
            </span>
            <span
              className={cn(
                "font-medium uppercase tracking-wide text-muted-foreground",
                compact ? "text-[9px]" : "text-[10px] sm:text-xs",
              )}
            >
              Losses
            </span>
          </div>
        </div>
        {onPodiumShareClick ? (
          <div className="relative z-[1] mt-2 flex justify-center">
            <SpectatorPlayerCardShareButton
              compact={compact}
              iconOnly={compact}
              onOpen={() => onPodiumShareClick(row)}
            />
          </div>
        ) : null}
        <div className="leaderboard-podium-card__pedestal" aria-hidden />
      </article>
    </LeaderboardPodiumFrame>
  );
}

function StandingRow({
  row,
  rank,
  compact = false,
  endorsementCounts,
  onEndorsementClick,
}: {
  row: LeaderboardRow;
  rank: number;
  compact?: boolean;
} & LeaderboardEndorsementProps) {
  const isPodium = rank <= 3;

  return (
    <li
      className={cn(
        "leaderboard-standing-row surface-muted border",
        compact ? "rounded-lg p-2" : "rounded-xl p-3 sm:p-4",
        isPodium && "leaderboard-standing-row-top",
        rank === 1 && "leaderboard-standing-row-gold",
        rank === 2 && "leaderboard-standing-row-silver",
        rank === 3 && "leaderboard-standing-row-bronze",
      )}
    >
      <div className={cn("flex items-center gap-2", compact ? "flex-col items-stretch" : "flex-wrap gap-3 sm:gap-4")}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <RankDisplay rank={rank} size={compact ? "sm" : "md"} />
          <PlayerAvatar player={row} size={compact ? "sm" : "default"} />
          <div className="min-w-0">
            <LeaderboardPlayerName
              row={row}
              rank={rank}
              nameClassName={cn("font-semibold", compact ? "text-sm" : "body-lg")}
              endorsementCounts={endorsementCounts}
              onEndorsementClick={onEndorsementClick}
            />
            {!compact ? (
              <p className="caption">
                {row.gamesPlayed} {row.gamesPlayed === 1 ? "game" : "games"} played
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                {row.wins}W · {row.losses}L · {row.winRate}%
              </p>
            )}
          </div>
        </div>

        {!compact ? (
          <div className="flex w-full flex-wrap items-end justify-between gap-3 sm:w-auto sm:justify-end">
            <div className="leaderboard-stat-group grid grid-cols-3 gap-3 sm:gap-4">
              <div className="text-center sm:text-right">
                <p className="caption">Wins</p>
                <p className="stat-num text-base font-bold text-emerald-600 dark:text-emerald-400">{row.wins}</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="caption">Losses</p>
                <p className="text-base font-semibold tabular-nums">{row.losses}</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="caption">Streak</p>
                <div className="mt-0.5 flex justify-center sm:justify-end">
                  <StreakBadge streak={row.currentStreak} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <StreakBadge streak={row.currentStreak} />
          </div>
        )}
      </div>

      {!compact ? (
        <div className="leaderboard-winrate mt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="caption">Win rate</span>
            <span className="text-sm font-semibold tabular-nums">{row.winRate}%</span>
          </div>
          <div className="leaderboard-winrate-track h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="leaderboard-winrate-fill h-full rounded-full transition-[width]"
              style={{ width: `${Math.min(100, Math.max(0, row.winRate))}%` }}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function LeaderboardStandings({
  rows,
  compact = false,
  endorsementCounts,
  onEndorsementClick,
  onPodiumShareClick,
}: {
  rows: LeaderboardRow[];
  compact?: boolean;
} & LeaderboardEndorsementProps &
  LeaderboardPodiumShareProps) {
  const showPodium = rows.length >= 3;
  const topThree = rows.slice(0, 3) as [LeaderboardRow?, LeaderboardRow?, LeaderboardRow?];
  const rest = showPodium ? rows.slice(3) : rows;

  return (
    <div className={cn("leaderboard-standings", compact ? "space-y-3" : "space-y-6")}>
      {showPodium ? (
        <div>
          <p
            className={cn(
              "mb-2 font-medium tracking-wide text-muted-foreground uppercase",
              compact ? "text-[10px]" : "caption mb-3",
            )}
          >
            Top 3
          </p>
          <div className={cn("leaderboard-podium-stage", compact && "leaderboard-podium-stage--compact")}>
            <div
              className={cn(
                "leaderboard-podium grid items-end",
                compact ? "grid-cols-3 gap-1.5" : "grid-cols-3 gap-2 sm:gap-3",
              )}
            >
              <PodiumCard
                row={topThree[1]!}
                rank={2}
                compact={compact}
                endorsementCounts={endorsementCounts}
                onEndorsementClick={onEndorsementClick}
                onPodiumShareClick={onPodiumShareClick}
              />
              <PodiumCard
                row={topThree[0]!}
                rank={1}
                compact={compact}
                endorsementCounts={endorsementCounts}
                onEndorsementClick={onEndorsementClick}
                onPodiumShareClick={onPodiumShareClick}
              />
              <PodiumCard
                row={topThree[2]!}
                rank={3}
                compact={compact}
                endorsementCounts={endorsementCounts}
                onEndorsementClick={onEndorsementClick}
                onPodiumShareClick={onPodiumShareClick}
              />
            </div>
          </div>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div>
          {showPodium ? (
            <p
              className={cn(
                "mb-2 font-medium tracking-wide text-muted-foreground uppercase",
                compact ? "text-[10px]" : "caption mb-3",
              )}
            >
              Rest of the field
            </p>
          ) : null}
          <ol
            className={cn("leaderboard-standing-list", compact ? "space-y-1.5" : "space-y-2")}
            aria-label="Full standings"
          >
            {rest.map((row, index) => (
              <StandingRow
                key={row.id}
                row={row}
                rank={showPodium ? index + 4 : index + 1}
                compact={compact}
                endorsementCounts={endorsementCounts}
                onEndorsementClick={onEndorsementClick}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
