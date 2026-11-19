import { PlayerAvatar, PlayerProfileTrigger } from "@/components/game/player-avatar";
import type * as React from "react";
import { cn, formatPlayerTableName } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { FirstTimerPill, resolveLeaderboardPlayerId, type LeaderboardRow } from "@/components/game/leaderboard-standings";
import { PlayerEndorsementStatusBadge } from "@/components/game/player-endorsement-status-badge";
import { UndefeatedBadge } from "@/components/game/undefeated-badge";
import { isSessionUndefeated } from "@/lib/games-played-map";

function MobileStat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-1">
      <span className="max-w-full truncate text-[0.6rem] leading-none font-medium text-muted-foreground uppercase">
        {label}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums", className)}>{value}</span>
    </div>
  );
}

export function LeaderboardTable({
  rows,
  endorsementCounts,
  onEndorsementClick,
}: {
  rows: LeaderboardRow[];
  endorsementCounts?: Record<string, number>;
  onEndorsementClick?: (row: LeaderboardRow) => void;
}) {
  const showNewBalls = rows.some((row) => (row.newBalls ?? 0) > 0);

  return (
    <>
    <ul className="leaderboard-table-mobile w-full min-w-0 max-w-full divide-y divide-border overflow-hidden rounded-lg border border-border [contain:inline-size] sm:hidden">
      {rows.map((row, index) => {
        const playerId = resolveLeaderboardPlayerId(row);
        const endorsementCount = endorsementCounts?.[playerId] ?? 0;
        const undefeated = isSessionUndefeated({ wins: row.wins, losses: row.losses });
        const hasBadges = row.isFirstTimer || undefeated || endorsementCount > 0;
        return (
          <li key={row.id} className="flex min-w-0 flex-col gap-2 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="w-7 shrink-0 text-sm font-semibold tabular-nums">#{index + 1}</span>
              <PlayerAvatar player={row} />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <PlayerProfileTrigger player={row} className="max-w-full truncate font-medium">
                  <span className="min-w-0 truncate">
                    {formatPlayerTableName(row.firstName, row.lastName)}
                  </span>
                </PlayerProfileTrigger>
                {hasBadges ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {row.isFirstTimer ? <FirstTimerPill /> : null}
                    {undefeated ? <UndefeatedBadge className="leaderboard-undefeated-badge" /> : null}
                    {endorsementCount > 0 ? (
                      <PlayerEndorsementStatusBadge
                        count={endorsementCount}
                        onClick={onEndorsementClick ? () => onEndorsementClick(row) : undefined}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div
              className={cn(
                "grid divide-x divide-border/60 rounded-md bg-muted/40 py-1.5",
                showNewBalls ? "grid-cols-6" : "grid-cols-5",
              )}
            >
              <MobileStat
                label="Wins"
                value={row.wins}
                className="text-emerald-600 dark:text-emerald-400"
              />
              <MobileStat label="Loss" value={row.losses} />
              <MobileStat label="Games" value={row.gamesPlayed} />
              <MobileStat label="Win %" value={`${row.winRate}%`} />
              <MobileStat label="Streak" value={row.currentStreak} />
              {showNewBalls ? <MobileStat label="New ball" value={row.newBalls ?? 0} /> : null}
            </div>
          </li>
        );
      })}
    </ul>
    <div className="leaderboard-table leaderboard-table-wrap overflow-x-auto rounded-lg border border-border max-sm:hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Wins</TableHead>
            <TableHead className="text-right">Losses</TableHead>
            <TableHead className="text-right">Games</TableHead>
            <TableHead className="text-right">Win %</TableHead>
            <TableHead className="text-right">Streak</TableHead>
            {showNewBalls ? <TableHead className="text-right">New ball</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const rank = index + 1;
            const playerId = resolveLeaderboardPlayerId(row);
            const endorsementCount = endorsementCounts?.[playerId] ?? 0;
            const undefeated = isSessionUndefeated({ wins: row.wins, losses: row.losses });
            const hasBadges = row.isFirstTimer || undefeated || endorsementCount > 0;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-semibold tabular-nums">#{rank}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex min-w-0 items-center gap-3">
                    <PlayerAvatar player={row} />
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <PlayerProfileTrigger player={row} className="max-w-full truncate">
                        <span className="min-w-0 truncate">
                          {formatPlayerTableName(row.firstName, row.lastName)}
                        </span>
                      </PlayerProfileTrigger>
                      {hasBadges ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {row.isFirstTimer ? <FirstTimerPill /> : null}
                          {undefeated ? (
                            <UndefeatedBadge className="leaderboard-undefeated-badge" />
                          ) : null}
                          {endorsementCount > 0 ? (
                            <PlayerEndorsementStatusBadge
                              count={endorsementCount}
                              onClick={
                                onEndorsementClick ? () => onEndorsementClick(row) : undefined
                              }
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="stat-num text-right text-emerald-600 dark:text-emerald-400">
                  {row.wins}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
                <TableCell className="text-right tabular-nums">{row.gamesPlayed}</TableCell>
                <TableCell className="text-right tabular-nums">{row.winRate}%</TableCell>
                <TableCell className="text-right tabular-nums">{row.currentStreak}</TableCell>
                {showNewBalls ? (
                  <TableCell className="text-right tabular-nums">{row.newBalls ?? 0}</TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
