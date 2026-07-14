import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";

/** Permanently remove an owner's game and all session data tied to gameId. */
export async function deleteOwnerGame(ownerId: string, gameId: string): Promise<boolean> {
  const deleted = await PickleGame.deleteOne({ gameId, ownerId });
  if (deleted.deletedCount === 0) return false;

  await Promise.all([
    QueueEntry.deleteMany({ gameId }),
    MatchHistory.deleteMany({ gameId }),
    LeaderboardStats.deleteMany({ gameId }),
    Court.deleteMany({ gameId }),
  ]);

  return true;
}
