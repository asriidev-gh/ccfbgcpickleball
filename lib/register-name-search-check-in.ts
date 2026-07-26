import { Types, type PipelineStage } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { assertGameRegistrationAllowed } from "@/lib/game-registration-limit";
import { isOwnerPreRegisteredPlayer } from "@/lib/owner-pre-registered-players";
import { buildOwnerRegisteredPlayerAccountGroupKey } from "@/lib/owner-registered-players";
import { isUploadedPlayerPhoto } from "@/lib/player-avatar-url";
import { recordPlayerRegisteredNotification } from "@/lib/organizer-notifications";
import {
  NAME_SEARCH_MIN_QUERY_LENGTH,
  type NameSearchPlayerItem,
  type NameSearchPlayersPage,
  type NameSearchQueueStatus,
} from "@/lib/register-name-search-check-in-shared";
import { formatPlayerDisplayName, formatPlayerTableName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

function escapeRegexLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSyntheticRegistrationPlayer(player: {
  email?: string | null;
  personalQrCode?: string | null;
}) {
  const personalQrCode = player.personalQrCode?.trim() ?? "";
  const email = player.email?.trim() ?? "";
  if (/^P-(owner|test|demo)-/i.test(personalQrCode)) return true;
  if (/@paddleflow\.local$/i.test(email)) return true;
  return isOwnerPreRegisteredPlayer(player, "");
}

type SessionQueueLean = {
  _id: Types.ObjectId;
  playerId: Types.ObjectId;
  status: string;
  removedFromSession?: boolean;
};

type RosterPlayerDoc = {
  _id: Types.ObjectId;
  firstName?: string;
  lastName?: string;
  email?: string;
  personalQrCode?: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  lastRegisteredAt?: Date | null;
};

function mapQueueStatus(entry: SessionQueueLean | undefined): NameSearchQueueStatus {
  if (!entry || entry.removedFromSession) return null;
  if (
    entry.status === "queued" ||
    entry.status === "on_court" ||
    entry.status === "done" ||
    entry.status === "checked_out"
  ) {
    return entry.status;
  }
  return null;
}

async function getOwnerGameIdsForSession(gameId: string) {
  const game = await PickleGame.findOne({ gameId })
    .select("gameId status ownerId")
    .lean<{ gameId: string; status?: string; ownerId?: Types.ObjectId } | null>();
  if (!game) {
    throw new Error("Game not found.");
  }

  const ownerId = game.ownerId?.toString();
  if (!ownerId) {
    return { game, ownerGameIds: [gameId] as string[] };
  }

  const ownerGames = await PickleGame.find({ ownerId })
    .select("gameId")
    .lean<Array<{ gameId: string }>>();
  const ownerGameIds = ownerGames.map((entry) => entry.gameId);
  if (!ownerGameIds.includes(gameId)) {
    ownerGameIds.push(gameId);
  }

  return { game, ownerGameIds };
}

async function queryOwnerRosterPlayerIds(ownerGameIds: string[], searchQuery: string) {
  const regex = escapeRegexLiteral(searchQuery);
  const pipeline: PipelineStage[] = [
    { $match: { gameId: { $in: ownerGameIds } } },
    {
      $project: {
        playerId: 1,
        gameId: 1,
        registeredAt: 1,
      },
    },
    {
      $unionWith: {
        coll: "leaderboardstats",
        pipeline: [
          { $match: { gameId: { $in: ownerGameIds } } },
          {
            $project: {
              playerId: 1,
              gameId: 1,
              registeredAt: "$updatedAt",
            },
          },
        ],
      },
    },
    {
      $group: {
        _id: "$playerId",
        lastRegisteredAt: { $max: "$registeredAt" },
      },
    },
    {
      $lookup: {
        from: "players",
        localField: "_id",
        foreignField: "_id",
        as: "player",
      },
    },
    { $unwind: "$player" },
    {
      $match: {
        "player.personalQrCode": { $not: { $regex: /^P-(owner|test|demo)-/i } },
        "player.email": { $not: { $regex: /@paddleflow\.local$/i } },
      },
    },
    {
      $addFields: {
        searchableText: {
          $concat: [
            { $ifNull: ["$player.firstName", ""] },
            " ",
            { $ifNull: ["$player.lastName", ""] },
          ],
        },
      },
    },
    {
      $match: {
        searchableText: { $regex: regex, $options: "i" },
      },
    },
    { $sort: { lastRegisteredAt: -1 } },
    {
      $project: {
        _id: 1,
        lastRegisteredAt: 1,
        firstName: "$player.firstName",
        lastName: "$player.lastName",
        email: "$player.email",
        personalQrCode: "$player.personalQrCode",
        photoUrl: "$player.photoUrl",
        photoPublicId: "$player.photoPublicId",
      },
    },
  ];

  return QueueEntry.aggregate<RosterPlayerDoc>(pipeline);
}

function dedupeRosterPlayersByAccount(rows: RosterPlayerDoc[]): RosterPlayerDoc[] {
  const groups = new Map<string, RosterPlayerDoc>();

  for (const row of rows) {
    const name = formatPlayerTableName(row.firstName ?? "", row.lastName ?? "") || "—";
    const email = row.email ?? "—";
    const key = buildOwnerRegisteredPlayerAccountGroupKey(name, email);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, row);
      continue;
    }

    const existingTime = existing.lastRegisteredAt
      ? new Date(existing.lastRegisteredAt).getTime()
      : 0;
    const rowTime = row.lastRegisteredAt ? new Date(row.lastRegisteredAt).getTime() : 0;
    const preferRow =
      rowTime > existingTime ||
      (isUploadedPlayerPhoto(row) && !isUploadedPlayerPhoto(existing));

    if (preferRow) {
      groups.set(key, row);
    }
  }

  return [...groups.values()].sort((a, b) => {
    const at = a.lastRegisteredAt ? new Date(a.lastRegisteredAt).getTime() : 0;
    const bt = b.lastRegisteredAt ? new Date(b.lastRegisteredAt).getTime() : 0;
    return bt - at;
  });
}

async function isPlayerInOwnerRoster(ownerGameIds: string[], playerObjectId: Types.ObjectId) {
  if (ownerGameIds.length === 0) return false;

  const [hasQueue, hasStats] = await Promise.all([
    QueueEntry.exists({
      gameId: { $in: ownerGameIds },
      playerId: playerObjectId,
    }),
    LeaderboardStats.exists({
      gameId: { $in: ownerGameIds },
      playerId: playerObjectId,
    }),
  ]);

  return Boolean(hasQueue || hasStats);
}

export async function searchPlayersByNameForRegistration(
  gameId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<NameSearchPlayersPage> {
  await connectToDatabase();

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(20, Math.max(1, options.pageSize ?? 10));
  const searchQuery = options.query?.trim() ?? "";

  const { ownerGameIds } = await getOwnerGameIdsForSession(gameId);

  if (searchQuery.length < NAME_SEARCH_MIN_QUERY_LENGTH) {
    return {
      players: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
    };
  }

  const rosterRows = await queryOwnerRosterPlayerIds(ownerGameIds, searchQuery);
  const dedupedRows = dedupeRosterPlayersByAccount(rosterRows);
  const total = dedupedRows.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = dedupedRows.slice(start, start + pageSize);

  if (pageRows.length === 0) {
    return {
      players: [],
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  }

  const playerIds = pageRows.map((row) => row._id);
  const sessionEntries = await QueueEntry.find({
    gameId,
    playerId: { $in: playerIds },
  })
    .sort({ registeredAt: -1 })
    .select("_id playerId status removedFromSession")
    .lean<SessionQueueLean[]>();

  const sessionByPlayerId = new Map<string, SessionQueueLean>();
  for (const entry of sessionEntries) {
    const id = entry.playerId.toString();
    if (sessionByPlayerId.has(id)) continue;
    sessionByPlayerId.set(id, entry);
  }

  const players: NameSearchPlayerItem[] = pageRows.map((row) => {
    const id = row._id.toString();
    const queueStatus = mapQueueStatus(sessionByPlayerId.get(id));
    const firstName = row.firstName ?? "";
    const lastName = row.lastName ?? "";
    const name = formatPlayerTableName(firstName, lastName) || "—";
    const canCheckIn = queueStatus === null;

    return {
      id,
      name,
      firstName,
      lastName,
      photoUrl: row.photoUrl,
      photoPublicId: row.photoPublicId,
      queueStatus,
      canCheckIn,
    };
  });

  return {
    players,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function checkInPlayerByNameSearch(gameId: string, playerId: string) {
  await connectToDatabase();

  if (!Types.ObjectId.isValid(playerId)) {
    throw new Error("Player not found.");
  }

  const playerObjectId = new Types.ObjectId(playerId);
  const [{ game, ownerGameIds }, player] = await Promise.all([
    getOwnerGameIdsForSession(gameId),
    Player.findById(playerObjectId)
      .select("firstName lastName email personalQrCode")
      .lean<{
        _id: Types.ObjectId;
        firstName?: string;
        lastName?: string;
        email?: string;
        personalQrCode?: string;
      } | null>(),
  ]);

  if (game.status === "ended") {
    throw new Error("Open play has ended. Reset the game to restart.");
  }
  if (!player) {
    throw new Error("Player not found.");
  }
  if (isSyntheticRegistrationPlayer(player)) {
    throw new Error("This player profile is not available for name-search check-in.");
  }

  const inRoster = await isPlayerInOwnerRoster(ownerGameIds, playerObjectId);
  if (!inRoster) {
    throw new Error("Player not found in this organizer's registration list.");
  }

  const name = formatPlayerDisplayName(player.firstName ?? "", player.lastName ?? "") || "Player";

  await assertGameRegistrationAllowed(gameId, {
    email: player.email ?? undefined,
    playerId,
  });

  await Player.updateOne({ _id: player._id }, { $set: { lastAttendedAt: new Date() } });
  await QueueEntry.create({
    gameId,
    playerId: player._id,
    status: "queued",
    queueType: "normal",
  });

  void recordPlayerRegisteredNotification({
    gameId,
    playerId: String(player._id),
    playerName: name,
  });

  return {
    message: `${name} added to the queue.`,
    playerId: String(player._id),
    player: {
      _id: String(player._id),
      firstName: player.firstName ?? "",
      lastName: player.lastName ?? "",
    },
  };
}
