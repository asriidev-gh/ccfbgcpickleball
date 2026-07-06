import { Types } from "mongoose";

import { deleteRegistrationPhotos } from "@/lib/cloudinary";
import { connectToDatabase } from "@/lib/db";
import { deleteMatchFromHistory } from "@/lib/match-history-delete";
import { resolvePlayerSiblings } from "@/lib/owner-player-actions";
import { isPastOpenPlaySession } from "@/lib/open-play-time-range";
import { isUploadedPlayerPhoto } from "@/lib/player-avatar-url";
import { formatPlayerDisplayName } from "@/lib/utils";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

async function recalculateLeaderboardWinRates(gameId: string) {
  const allStats = await LeaderboardStats.find({ gameId });
  await Promise.all(
    allStats.map(async (stat) => {
      stat.winRate =
        stat.gamesPlayed > 0 ? Math.round((stat.wins / stat.gamesPlayed) * 100) : 0;
      await stat.save();
    }),
  );
}

async function resolveLatestRegisteredPlayerId(playerIds: string[]) {
  if (playerIds.length === 0) return null;

  const objectIds = playerIds.map((id) => new Types.ObjectId(id));
  const latestByQueue = (await QueueEntry.aggregate([
    { $match: { playerId: { $in: objectIds } } },
    { $group: { _id: "$playerId", latestRegisteredAt: { $max: "$registeredAt" } } },
    { $sort: { latestRegisteredAt: -1 } },
    { $limit: 1 },
  ])) as Array<{ _id: Types.ObjectId }>;

  if (latestByQueue.length > 0) {
    return latestByQueue[0]._id.toString();
  }

  const latestByCreated = await Player.findOne({ _id: { $in: objectIds } })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  return latestByCreated?._id.toString() ?? null;
}

function remapTeamPlayerIds(
  ids: Types.ObjectId[],
  fromId: Types.ObjectId,
  toId: Types.ObjectId,
) {
  const seen = new Set<string>();
  const result: Types.ObjectId[] = [];

  for (const id of ids) {
    const mapped = id.equals(fromId) ? toId : id;
    const key = mapped.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(mapped);
  }

  return result;
}

async function mergeLeaderboardStats(fromId: Types.ObjectId, toId: Types.ObjectId) {
  const affectedGameIds = new Set<string>();
  const fromStats = await LeaderboardStats.find({ playerId: fromId });

  for (const fromStat of fromStats) {
    affectedGameIds.add(fromStat.gameId);
    const targetStat = await LeaderboardStats.findOne({
      gameId: fromStat.gameId,
      playerId: toId,
    });

    if (targetStat) {
      targetStat.gamesPlayed += fromStat.gamesPlayed;
      targetStat.wins += fromStat.wins;
      targetStat.losses += fromStat.losses;
      targetStat.winRate =
        targetStat.gamesPlayed > 0
          ? Math.round((targetStat.wins / targetStat.gamesPlayed) * 100)
          : 0;
      await targetStat.save();
      await LeaderboardStats.deleteOne({ _id: fromStat._id });
    } else {
      fromStat.playerId = toId;
      await fromStat.save();
    }
  }

  return affectedGameIds;
}

async function transferMatchHistoryPlayerIds(fromId: Types.ObjectId, toId: Types.ObjectId) {
  const affectedGameIds = new Set<string>();
  const matches = await MatchHistory.find({
    $or: [{ teamAPlayerIds: fromId }, { teamBPlayerIds: fromId }],
  });

  for (const match of matches) {
    const includesDeletedPlayer = [...match.teamAPlayerIds, ...match.teamBPlayerIds].some((id) =>
      id.equals(fromId),
    );
    if (!includesDeletedPlayer) continue;

    match.teamAPlayerIds = remapTeamPlayerIds(match.teamAPlayerIds, fromId, toId);
    match.teamBPlayerIds = remapTeamPlayerIds(match.teamBPlayerIds, fromId, toId);
    match.markModified("teamAPlayerIds");
    match.markModified("teamBPlayerIds");
    await match.save();
    affectedGameIds.add(match.gameId);
  }

  return affectedGameIds;
}

async function deletePlayerMatchHistory(playerObjectId: Types.ObjectId) {
  const affectedGameIds = new Set<string>();
  const matches = await MatchHistory.find({
    $or: [{ teamAPlayerIds: playerObjectId }, { teamBPlayerIds: playerObjectId }],
  }).select("_id gameId");

  for (const match of matches) {
    affectedGameIds.add(match.gameId);
    await deleteMatchFromHistory({
      gameId: match.gameId,
      matchId: match._id.toString(),
    });
  }

  return affectedGameIds;
}

async function cleanupPlayerReferences(playerObjectId: Types.ObjectId) {
  const queueEntries = await QueueEntry.find({ playerId: playerObjectId }).select("_id");
  const queueEntryIds = queueEntries.map((entry) => entry._id);

  await Promise.all([
    QueueEntry.deleteMany({ playerId: playerObjectId }),
    Volunteer.deleteMany({ playerId: playerObjectId }),
    Court.updateMany(
      {},
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
}

async function assertPlayerCanBeDeletedFromOwnerGames(
  ownerId: string,
  playerObjectId: Types.ObjectId,
  playerName: string,
) {
  const ownerGames = await PickleGame.find({ ownerId })
    .select("gameId status openPlayDate title")
    .lean<Array<{ gameId: string; status?: string; openPlayDate?: Date | null; title: string }>>();

  for (const game of ownerGames) {
    if (isPastOpenPlaySession(game)) continue;

    const courts = await Court.find({ gameId: game.gameId, status: "active" }).select("teamA teamB");
    const onCourt = courts.some(
      (court) =>
        court.teamA.playerIds.some((id: Types.ObjectId) => id.equals(playerObjectId)) ||
        court.teamB.playerIds.some((id: Types.ObjectId) => id.equals(playerObjectId)),
    );

    if (onCourt) {
      throw new Error(
        `${game.title}: ${playerName} is currently on a court in an active session. Replace them or cancel the court assignment before removing.`,
      );
    }
  }
}

/** Deletes one player account, transfers session history to the latest sibling when possible. */
export async function deleteOwnerRegisteredPlayerAccount(ownerId: string, playerId: string) {
  await connectToDatabase();

  const playerObjectId = new Types.ObjectId(playerId);
  const player = await Player.findById(playerObjectId).select(
    "firstName lastName email photoUrl photoPublicId",
  );
  if (!player) {
    throw new Error("Player not found.");
  }

  const playerName = formatPlayerDisplayName(player.firstName ?? "", player.lastName ?? "");
  const resolved = await resolvePlayerSiblings(playerId);
  if (!resolved) {
    throw new Error("Player not found.");
  }

  await assertPlayerCanBeDeletedFromOwnerGames(ownerId, playerObjectId, playerName);

  const otherSiblingIds = resolved.playerObjectIds.filter((id) => id !== playerId);
  const transferTargetId =
    otherSiblingIds.length > 0 ? await resolveLatestRegisteredPlayerId(otherSiblingIds) : null;

  const affectedGameIds = new Set<string>();

  if (transferTargetId) {
    const targetObjectId = new Types.ObjectId(transferTargetId);
    const mergedGames = await mergeLeaderboardStats(playerObjectId, targetObjectId);
    mergedGames.forEach((gameId) => affectedGameIds.add(gameId));
    const matchGames = await transferMatchHistoryPlayerIds(playerObjectId, targetObjectId);
    matchGames.forEach((gameId) => affectedGameIds.add(gameId));
  } else {
    const matchGames = await deletePlayerMatchHistory(playerObjectId);
    matchGames.forEach((gameId) => affectedGameIds.add(gameId));
    const remainingStats = await LeaderboardStats.find({ playerId: playerObjectId }).select("gameId");
    remainingStats.forEach((stat) => affectedGameIds.add(stat.gameId));
    await LeaderboardStats.deleteMany({ playerId: playerObjectId });
  }

  await cleanupPlayerReferences(playerObjectId);

  for (const gameId of affectedGameIds) {
    await recalculateLeaderboardWinRates(gameId);
  }

  if (isUploadedPlayerPhoto(player) && player.photoPublicId?.trim()) {
    await deleteRegistrationPhotos([player.photoPublicId.trim()]);
  }
  await Player.deleteOne({ _id: playerObjectId });

  return {
    playerName,
    transferredToId: transferTargetId,
  };
}
