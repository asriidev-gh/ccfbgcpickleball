import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { LeaderboardMedalIcon } from "@/components/game/leaderboard-medal-icon";
import { cn, formatPlayerDisplayName } from "@/lib/utils";

export type LeaderboardRow = {
  id: string;
  firstName: string;
  lastName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
};

function displayLabel(row: LeaderboardRow, rank: number) {
  return formatPlayerDisplayName(row.firstName, row.lastName, rank);
}

function RankDisplay({ rank, size = "md" }: { rank: number; size?: "sm" | "md" | "lg" }) {
  if (rank === 1 || rank === 2 || rank === 3) {
    return (
      <span className="leaderboard-rank-medal inline-flex shrink-0 items-center justify-center">
        <LeaderboardMedalIcon rank={rank as 1 | 2 | 3} size={size} />
      </span>
    );
  }
  return (
    <span className="leaderboard-rank-badge leaderboard-rank-badge-default" aria-label={`Rank ${rank}`}>
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

function PodiumCard({
  row,
  rank,
  compact = false,
}: {
  row: LeaderboardRow;
  rank: 1 | 2 | 3;
  compact?: boolean;
}) {
  const podiumClass =
    rank === 1 ? "leaderboard-podium-card-gold" : rank === 2 ? "leaderboard-podium-card-silver" : "leaderboard-podium-card-bronze";

  return (
    <article
      className={cn(
        "leaderboard-podium-card surface-muted flex flex-col items-center rounded-lg border text-center",
        compact ? "px-1.5 py-2" : "rounded-xl px-3 py-4",
        podiumClass,
        rank === 1 && !compact && "md:-mt-2 md:pb-5",
      )}
    >
      <RankDisplay rank={rank} size={compact ? "sm" : "lg"} />
      <p
        className={cn(
          "mt-1 line-clamp-2 font-semibold leading-tight",
          compact ? "text-xs" : "body-lg mt-2",
        )}
      >
        {displayLabel(row, rank)}
      </p>
      <p className={cn("stat-num font-bold tabular-nums", compact ? "mt-0.5 text-sm" : "mt-1 text-lg")}>
        {row.wins}
      </p>
      {!compact ? <p className="caption">wins</p> : null}
      <p className={cn("text-muted-foreground", compact ? "mt-0.5 text-[10px]" : "caption mt-2")}>
        {row.winRate}%
      </p>
    </article>
  );
}

function StandingRow({
  row,
  rank,
  compact = false,
}: {
  row: LeaderboardRow;
  rank: number;
  compact?: boolean;
}) {
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
          <div className="min-w-0">
            <p className={cn("truncate font-semibold", compact ? "text-sm" : "body-lg")}>
              {displayLabel(row, rank)}
            </p>
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
}: {
  rows: LeaderboardRow[];
  compact?: boolean;
}) {
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
          <div
            className={cn(
              "leaderboard-podium grid items-end",
              compact ? "grid-cols-3 gap-1" : "grid-cols-3 gap-2 sm:gap-3",
            )}
          >
            <PodiumCard row={topThree[1]!} rank={2} compact={compact} />
            <PodiumCard row={topThree[0]!} rank={1} compact={compact} />
            <PodiumCard row={topThree[2]!} rank={3} compact={compact} />
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
              />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
