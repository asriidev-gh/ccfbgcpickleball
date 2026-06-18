import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  assertGameRegistrationAllowed,
  getPlayerQueueStatusForGame,
  RegistrationLimitError,
} from "@/lib/game-registration-limit";
import { getOwnerRegisteredPlayers } from "@/lib/owner-registered-players";
import type {
  DatabaseCheckInPlayerItem,
  DatabaseCheckInPlayersPage,
  DatabaseCheckInQueueStatus,
} from "@/lib/operator-database-check-in-shared";
import type { OwnerRegisteredPlayerItem } from "@/lib/owner-registered-players-shared";
import { OWNER_REGISTERED_PLAYERS_PAGE_SIZE } from "@/lib/owner-registered-players-shared";
import { recordPlayerRegisteredNotification } from "@/lib/organizer-notifications";
import { ALREADY_REGISTERED_MESSAGE } from "@/lib/registration-messages";
import { formatPlayerDisplayName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

const ACTIVE_SESSION_QUEUE_STATUSES = ["queued", "on_court", "done"] as const;

async function getActiveSessionPlayerIds(gameId: string) {
  const playerIds = await QueueEntry.distinct("playerId", {
    gameId,
    status: { $in: ACTIVE_SESSION_QUEUE_STATUSES },
  });
  return new Set(playerIds.map((id) => id.toString()));
}

async function assertPlayerInOwnerRoster(ownerId: string, playerId: string) {
  await connectToDatabase();

  const ownerGames = await PickleGame.find({ ownerId }).select("gameId").lean<Array<{ gameId: string }>>();
  const ownerGameIds = ownerGames.map((game) => game.gameId);
  if (ownerGameIds.length === 0) {
    throw new Error("Player not found in your registration list.");
  }

  const playerObjectId = new Types.ObjectId(playerId);
  const hasQueue = await QueueEntry.exists({
    gameId: { $in: ownerGameIds },
    playerId: playerObjectId,
  });
  if (hasQueue) return;

  const hasStats = await LeaderboardStats.exists({
    gameId: { $in: ownerGameIds },
    playerId: playerObjectId,
  });
  if (hasStats) return;

  throw new Error("Player not found in your registration list.");
}

async function getQueueStatusMapForGame(gameId: string, playerIds: string[]) {
  const statusMap = new Map<string, { status: DatabaseCheckInQueueStatus; queueEntryId: string | null }>();

  if (playerIds.length === 0) return statusMap;

  const objectIds = playerIds.map((id) => new Types.ObjectId(id));
  const entries = await QueueEntry.find({
    gameId,
    playerId: { $in: objectIds },
  })
    .sort({ registeredAt: -1 })
    .select("playerId status")
    .lean<Array<{ _id: Types.ObjectId; playerId: Types.ObjectId; status: string }>>();

  for (const entry of entries) {
    const playerId = entry.playerId.toString();
    if (statusMap.has(playerId)) continue;

    const status = entry.status as DatabaseCheckInQueueStatus;
    statusMap.set(playerId, {
      status,
      queueEntryId: entry._id.toString(),
    });
  }

  return statusMap;
}

function enrichPlayersWithQueueStatus(
  players: OwnerRegisteredPlayerItem[],
  statusMap: Map<string, { status: DatabaseCheckInQueueStatus; queueEntryId: string | null }>,
): DatabaseCheckInPlayerItem[] {
  return players.map((player) => {
    const queueInfo = statusMap.get(player.id);
    const queueStatus = queueInfo?.status ?? null;
    const canCheckIn =
      !player.isBlocked && (queueStatus === null || queueStatus === "checked_out");

    return {
      ...player,
      queueStatus,
      queueEntryId: queueInfo?.queueEntryId ?? null,
      canCheckIn,
    };
  });
}

export async function getDatabaseCheckInPlayersForGame(
  ownerId: string,
  gameId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<DatabaseCheckInPlayersPage> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId, ownerId }).select("gameId").lean();
  if (!game) {
    throw new Error("Game not found.");
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(
    50,
    Math.max(1, options.pageSize ?? OWNER_REGISTERED_PLAYERS_PAGE_SIZE),
  );

  const [activePlayerIds, result] = await Promise.all([
    getActiveSessionPlayerIds(gameId),
    getOwnerRegisteredPlayers(ownerId, {
      query: options.query,
      exportAll: true,
    }),
  ]);

  const eligiblePlayers = result.players.filter((player) => !activePlayerIds.has(player.id));
  const total = eligiblePlayers.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pagePlayers = eligiblePlayers.slice(start, start + pageSize);

  const statusMap = await getQueueStatusMapForGame(
    gameId,
    pagePlayers.map((player) => player.id),
  );

  return {
    players: enrichPlayersWithQueueStatus(pagePlayers, statusMap),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

async function reactivateCheckedOutEntry(gameId: string, playerId: string) {
  const checkedOutEntry = await QueueEntry.findOne({
    gameId,
    playerId,
    status: "checked_out",
  }).select("_id");

  if (!checkedOutEntry) {
    throw new Error("Checked-out player not found.");
  }

  const alreadyQueued = await QueueEntry.findOne({
    gameId,
    status: "queued",
    playerId,
  }).select("_id");
  if (alreadyQueued) {
    throw new Error("Player is already in the queue.");
  }

  const lastQueued = await QueueEntry.findOne({ gameId, status: "queued" })
    .sort({ registeredAt: -1 })
    .select("registeredAt")
    .lean<{ registeredAt?: Date } | null>();

  const baseTime = lastQueued?.registeredAt
    ? new Date(lastQueued.registeredAt).getTime()
    : Date.now();
  const registeredAt = new Date(baseTime + 1000);

  const entry = await QueueEntry.findOneAndUpdate(
    { _id: checkedOutEntry._id, gameId, status: "checked_out" },
    {
      $set: {
        status: "queued",
        queueType: "normal",
        pairGroupId: null,
        registeredAt,
      },
    },
    { returnDocument: "after" },
  ).populate("playerId", "firstName lastName");

  if (!entry) {
    throw new Error("Checked-out player not found.");
  }

  const player = entry.playerId as { firstName?: string; lastName?: string } | null;
  const name = formatPlayerDisplayName(player?.firstName ?? "", player?.lastName ?? "");

  return `${name} checked back in at the end of the queue.`;
}

export async function operatorCheckInPlayerFromDatabase(
  ownerId: string,
  gameId: string,
  playerId: string,
) {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId, ownerId });
  if (!game) {
    throw new Error("Game not found.");
  }
  if (game.status === "ended") {
    throw new Error("Open play has ended. Reset the game to restart.");
  }

  await assertPlayerInOwnerRoster(ownerId, playerId);

  const player = await Player.findById(playerId);
  if (!player) {
    throw new Error("Player not found.");
  }

  const queueStatus = await getPlayerQueueStatusForGame(gameId, playerId);
  if (queueStatus === "active") {
    throw new RegistrationLimitError(ALREADY_REGISTERED_MESSAGE, 409, {
      playerId,
      alreadyRegistered: true,
    });
  }

  await assertGameRegistrationAllowed(gameId, { email: player.email ?? undefined });

  if (queueStatus === "checked_out") {
    const message = await reactivateCheckedOutEntry(gameId, playerId);
    return { message, playerId };
  }

  player.lastAttendedAt = new Date();
  await player.save();

  await QueueEntry.create({
    gameId,
    playerId: player._id,
    status: "queued",
    queueType: "normal",
  });

  await recordPlayerRegisteredNotification({
    gameId,
    playerId: String(player._id),
    playerName: formatPlayerDisplayName(player.firstName, player.lastName),
  });

  const name = formatPlayerDisplayName(player.firstName, player.lastName);
  return {
    message: `${name} added to the queue.`,
    playerId: String(player._id),
  };
}
