import { connectToDatabase } from "@/lib/db";
import { recordPlayerCardSharedNotification } from "@/lib/organizer-notifications";
import { formatPlayerDisplayName } from "@/lib/utils";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import "@/models/Player";

export async function markSpectatorPlayerCardShared(
  gameId: string,
  queueEntryId: string,
  allowedPlayerIds: string[],
) {
  await connectToDatabase();

  const uniquePlayerIds = Array.from(new Set(allowedPlayerIds.filter(Boolean)));
  if (uniquePlayerIds.length === 0) {
    throw new Error("Player session is required.");
  }

  const game = await PickleGame.findOne({ gameId }).select("status").lean();
  if (!game) {
    throw new Error("Game not found.");
  }
  if (game.status !== "active") {
    throw new Error("Open play is not active.");
  }

  const entry = await QueueEntry.findOne({
    _id: queueEntryId,
    gameId,
    playerId: { $in: uniquePlayerIds },
    status: { $in: ["queued", "checked_out"] },
  }).populate("playerId", "firstName lastName");

  if (!entry) {
    throw new Error("You can only share your own player card.");
  }

  const player = entry.playerId as {
    _id?: { toString(): string };
    firstName?: string;
    lastName?: string;
  } | null;

  if (!player?._id) {
    throw new Error("Player not found.");
  }

  entry.cardSharedAt = new Date();
  await entry.save();

  const playerName =
    formatPlayerDisplayName(player.firstName, player.lastName) || "Player";

  await recordPlayerCardSharedNotification({
    gameId,
    playerId: player._id.toString(),
    playerName,
    queueEntryId,
  });

  return {
    queueEntryId,
    cardSharedAt: entry.cardSharedAt.toISOString(),
  };
}
