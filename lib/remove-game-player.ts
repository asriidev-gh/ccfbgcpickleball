import { Types } from "mongoose";

import { deleteMatchFromHistory } from "@/lib/match-history-delete";
import { isPastOpenPlaySession } from "@/lib/open-play-time-range";
import { formatPlayerDisplayName } from "@/lib/utils";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

async function isPlayerOnActiveCourt(gameId: string, playerObjectId: Types.ObjectId) {
  const courts = await Court.find({ gameId, status: "active" }).select("teamA teamB");
  return courts.some(
    (court) =>
      court.teamA.playerIds.some((id: Types.ObjectId) => id.equals(playerObjectId)) ||
      court.teamB.playerIds.some((id: Types.ObjectId) => id.equals(playerObjectId)),
  );
}

export async function removePlayerFromGame(input: {
  gameId: string;
  playerId: string;
}): Promise<{ playerName: string }> {
  const playerObjectId = new Types.ObjectId(input.playerId);
  const player = await Player.findById(playerObjectId).select("firstName lastName");
  if (!player) {
    throw new Error("Player not found.");
  }

  const game = await PickleGame.findOne({ gameId: input.gameId })
    .select("status openPlayDate")
    .lean<{ status?: string; openPlayDate?: Date | null } | null>();

  const onCourt =
    game && !isPastOpenPlaySession(game)
      ? await isPlayerOnActiveCourt(input.gameId, playerObjectId)
      : false;
  if (onCourt) {
    throw new Error(
      `${formatPlayerDisplayName(player.firstName, player.lastName)} is currently on a court. Replace them or cancel the court assignment before removing.`,
    );
  }

  const entries = await QueueEntry.find({
    gameId: input.gameId,
    playerId: playerObjectId,
  }).select("_id");
  const queueEntryIds = entries.map((entry) => entry._id);

  if (queueEntryIds.length === 0) {
    const hasStats = await LeaderboardStats.exists({
      gameId: input.gameId,
      playerId: playerObjectId,
    });
    if (!hasStats) {
      throw new Error("Player is not registered for this open play.");
    }
  }

  const matches = await MatchHistory.find({
    gameId: input.gameId,
    $or: [{ teamAPlayerIds: playerObjectId }, { teamBPlayerIds: playerObjectId }],
  }).select("_id");

  // Remove match history first so leaderboard stats for remaining players are updated correctly.
  for (const match of matches) {
    await deleteMatchFromHistory({
      gameId: input.gameId,
      matchId: match._id.toString(),
    });
  }

  await Promise.all([
    QueueEntry.updateMany(
      { gameId: input.gameId, playerId: playerObjectId },
      {
        $set: {
          status: "checked_out",
          removedFromSession: true,
          queueType: "normal",
          pairGroupId: null,
        },
      },
    ),
    LeaderboardStats.deleteOne({ gameId: input.gameId, playerId: playerObjectId }),
    Volunteer.deleteOne({ gameId: input.gameId, playerId: playerObjectId }),
    Court.updateMany(
      { gameId: input.gameId },
      {
        $pull: {
          "teamA.playerIds": playerObjectId,
          "teamB.playerIds": playerObjectId,
          "teamA.queueEntryIds": { $in: queueEntryIds },
          "teamB.queueEntryIds": { $in: queueEntryIds },
        },
      },
    ),
  ]);

  return {
    playerName: formatPlayerDisplayName(player.firstName, player.lastName),
  };
}
