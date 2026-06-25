import { PlayerNameWithPhoto } from "@/components/game/player-avatar";
import { formatPlayerTableName } from "@/lib/utils";
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

export function LeaderboardTable({
  rows,
  endorsementCounts,
  onEndorsementClick,
}: {
  rows: LeaderboardRow[];
  endorsementCounts?: Record<string, number>;
  onEndorsementClick?: (row: LeaderboardRow) => void;
}) {
  return (
    <div className="leaderboard-table leaderboard-table-wrap overflow-x-auto rounded-lg border border-border">
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const rank = index + 1;
            const playerId = resolveLeaderboardPlayerId(row);
            const endorsementCount = endorsementCounts?.[playerId] ?? 0;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-semibold tabular-nums">#{rank}</TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
                    <PlayerNameWithPhoto player={row}>
                      {formatPlayerTableName(row.firstName, row.lastName)}
                    </PlayerNameWithPhoto>
                    {row.isFirstTimer ? <FirstTimerPill /> : null}
                    {isSessionUndefeated({ wins: row.wins, losses: row.losses }) ? (
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
                  </span>
                </TableCell>
                <TableCell className="stat-num text-right text-emerald-600 dark:text-emerald-400">
                  {row.wins}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
                <TableCell className="text-right tabular-nums">{row.gamesPlayed}</TableCell>
                <TableCell className="text-right tabular-nums">{row.winRate}%</TableCell>
                <TableCell className="text-right tabular-nums">{row.currentStreak}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
