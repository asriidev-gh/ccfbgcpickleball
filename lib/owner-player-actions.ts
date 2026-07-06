import { connectToDatabase } from "@/lib/db";
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
