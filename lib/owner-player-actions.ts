import { connectToDatabase } from "@/lib/db";
import { removePlayerFromGame } from "@/lib/remove-game-player";
import { formatPlayerDisplayName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

export async function resolvePlayerSiblings(playerId: string) {
  const player = await Player.findById(playerId)
    .select("firstName lastName email")
    .lean<{ firstName?: string; lastName?: string; email?: string } | null>();
  if (!player) return null;

  const siblings = await Player.find({
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email,
  })
    .select("_id")
    .lean<Array<{ _id: { toString(): string } }>>();

  return {
    player,
    playerObjectIds: siblings.map((doc) => doc._id.toString()),
  };
}

export async function assertPlayerRegisteredWithOwner(
  ownerId: string,
  playerId: string,
): Promise<{ email: string; name: string }> {
  await connectToDatabase();
  const resolved = await resolvePlayerSiblings(playerId);
  if (!resolved) {
    throw new Error("Player not found.");
  }

  const ownerGameIds = await PickleGame.find({ ownerId }).distinct("gameId");
  if (ownerGameIds.length === 0) {
    throw new Error("This player is not registered in any of your open play sessions.");
  }

  const registered = await QueueEntry.exists({
    gameId: { $in: ownerGameIds },
    playerId: { $in: resolved.playerObjectIds },
  });

  const hasStats = await LeaderboardStats.exists({
    gameId: { $in: ownerGameIds },
    playerId: { $in: resolved.playerObjectIds },
  });

  if (!registered && !hasStats) {
    throw new Error("This player is not registered in any of your open play sessions.");
  }

  return {
    email: resolved.player.email ?? "",
    name: formatPlayerDisplayName(resolved.player.firstName ?? "", resolved.player.lastName ?? ""),
  };
}

/** Removes a player from every open play session owned by this organizer. */
export async function removePlayerFromOwnerGames(ownerId: string, playerId: string) {
  await connectToDatabase();
  const resolved = await resolvePlayerSiblings(playerId);
  if (!resolved) return false;

  const ownerGames = await PickleGame.find({ ownerId }).select("gameId title").lean<
    Array<{ gameId: string; title: string }>
  >();

  for (const game of ownerGames) {
    for (const siblingId of resolved.playerObjectIds) {
      const hasQueue = await QueueEntry.exists({ gameId: game.gameId, playerId: siblingId });
      const hasStats = await LeaderboardStats.exists({ gameId: game.gameId, playerId: siblingId });
      if (!hasQueue && !hasStats) continue;

      try {
        await removePlayerFromGame({ gameId: game.gameId, playerId: siblingId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove player.";
        throw new Error(`${game.title}: ${message}`);
      }
    }
  }

  return true;
}
