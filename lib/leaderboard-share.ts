import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { LeaderboardRow } from "@/components/game/leaderboard-standings";
import { resolveLeaderboardPlayerId } from "@/components/game/leaderboard-standings";

export function leaderboardRowToShareEntry(row: LeaderboardRow): QueueEntryView {
  const playerId = resolveLeaderboardPlayerId(row);
  return {
    _id: `leaderboard-share-${playerId}`,
    queueType: "normal",
    playerId: {
      ...row,
      _id: playerId,
    },
    registeredAt: "",
    lastMatchResult: "none",
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.gamesPlayed,
  };
}
