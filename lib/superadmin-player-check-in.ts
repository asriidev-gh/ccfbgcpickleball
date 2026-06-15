import { getPlayerQueueStatusForGame } from "@/lib/game-registration-limit";
import { connectToDatabase } from "@/lib/db";
import { formatPlayerDisplayName } from "@/lib/utils";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";

export async function resolveSuperadminViewAsPlayer(gameId: string, playerId: string) {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("status").lean<{ status?: string }>();
  if (!game) {
    throw new Error("Game not found.");
  }

  const queueStatus = await getPlayerQueueStatusForGame(gameId, playerId);
  if (queueStatus === null) {
    throw new Error("Player is not registered in this session.");
  }

  const player = await Player.findById(playerId).select("firstName lastName").lean<{
    firstName: string;
    lastName?: string | null;
  }>();
  if (!player) {
    throw new Error("Player not found.");
  }

  return {
    playerId,
    playerName: formatPlayerDisplayName(player.firstName, player.lastName ?? ""),
    queueStatus,
  };
}
