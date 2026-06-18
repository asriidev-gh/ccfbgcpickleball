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

import { FirstTimerPill, type LeaderboardRow } from "@/components/game/leaderboard-standings";

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="leaderboard-table-wrap overflow-x-auto rounded-lg border border-border">
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
            return (
              <TableRow key={row.id}>
                <TableCell className="font-semibold tabular-nums">#{rank}</TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
                    <PlayerNameWithPhoto player={row}>
                      {formatPlayerTableName(row.firstName, row.lastName)}
                    </PlayerNameWithPhoto>
                    {row.isFirstTimer ? <FirstTimerPill /> : null}
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
