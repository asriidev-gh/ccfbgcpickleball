import { LeaderboardStats } from "@/models/LeaderboardStats";
import { QueueEntry } from "@/models/QueueEntry";

export async function getGameSessionPlayerIds(gameId: string) {
  const [queueIds, statsIds] = await Promise.all([
    QueueEntry.distinct("playerId", { gameId }),
    LeaderboardStats.distinct("playerId", { gameId }),
  ]);

  return [...new Set([...queueIds.map(String), ...statsIds.map(String)])];
}
