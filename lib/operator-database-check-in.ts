import { Types, type PipelineStage } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  assertGameRegistrationAllowed,
  getPlayerQueueStatusForGame,
  RegistrationLimitError,
} from "@/lib/game-registration-limit";
import { getBlockedEmailsForOrganizer } from "@/lib/organizer-blocked-player";
import type {
  DatabaseCheckInPlayerItem,
  DatabaseCheckInPlayersPage,
  DatabaseCheckInQueueStatus,
} from "@/lib/operator-database-check-in-shared";
import type { OwnerRegisteredPlayerItem } from "@/lib/owner-registered-players-shared";
import { buildOwnerRegisteredPlayerAccountGroupKey } from "@/lib/owner-registered-players";
import { recordPlayerRegisteredNotification } from "@/lib/organizer-notifications";
import { ALREADY_REGISTERED_MESSAGE } from "@/lib/registration-messages";
import { formatPlayerDisplayName, formatPlayerTableName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

const ACTIVE_SESSION_QUEUE_STATUSES = ["queued", "on_court", "done"] as const;

function escapeRegexLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type RosterGroupRow = {
  _id: Types.ObjectId;
  lastRegisteredAt?: Date;
  gameIds?: string[];
};

type DatabaseCheckInRosterRow = RosterGroupRow & {
  player: {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    photoUrl?: string | null;
    photoPublicId?: string | null;
    personalQrCode?: string;
    welcomeEmailStatus?: string;
    welcomeEmailError?: string;
    welcomeEmailSentAt?: Date | null;
  };
  sessionQueueEntry?: Array<{ _id: Types.ObjectId; status: string; removedFromSession?: boolean }>;
};

function mapRosterRowToPlayerItem(
  row: DatabaseCheckInRosterRow,
  blockedEmails: Set<string>,
): OwnerRegisteredPlayerItem {
  const player = row.player;
  const email = player.email ?? "—";
  const name = formatPlayerTableName(player.firstName ?? "", player.lastName ?? "") || "—";

  return {
    id: row._id.toString(),
    name,
    firstName: player.firstName ?? "",
    lastName: player.lastName ?? "",
    email,
    mobileNumber: player.mobileNumber ?? "—",
    photoUrl: player.photoUrl,
    photoPublicId: player.photoPublicId,
    personalQrCode: player.personalQrCode,
    sessionsCount: row.gameIds?.length ?? 0,
    accountCount: 1,
    accountGroupKey: buildOwnerRegisteredPlayerAccountGroupKey(name, email),
    lastRegisteredAt: row.lastRegisteredAt ? row.lastRegisteredAt.toISOString() : null,
    isBlocked: blockedEmails.has(email.trim().toLowerCase()),
    welcomeEmailStatus: (player.welcomeEmailStatus ?? "") as OwnerRegisteredPlayerItem["welcomeEmailStatus"],
    welcomeEmailError: player.welcomeEmailError?.trim() ?? "",
    welcomeEmailSentAt: player.welcomeEmailSentAt
      ? new Date(player.welcomeEmailSentAt).toISOString()
      : null,
  };
}

function mapRosterRowToCheckInItem(
  row: DatabaseCheckInRosterRow,
  blockedEmails: Set<string>,
): DatabaseCheckInPlayerItem {
  const playerItem = mapRosterRowToPlayerItem(row, blockedEmails);
  const sessionEntry = row.sessionQueueEntry?.[0];
  const queueStatus = (
    sessionEntry?.removedFromSession
      ? null
      : (sessionEntry?.status ?? null)
  ) as DatabaseCheckInQueueStatus | null;
  const canCheckIn =
    !playerItem.isBlocked && (queueStatus === null || queueStatus === "checked_out");

  return {
    ...playerItem,
    queueStatus,
    queueEntryId: sessionEntry?._id.toString() ?? null,
    canCheckIn,
  };
}

async function queryDatabaseCheckInRoster(
  ownerGameIds: string[],
  activePlayerIds: Set<string>,
  gameId: string,
  options: { page: number; pageSize: number; query?: string },
) {
  const page = Math.max(1, options.page);
  const pageSize = Math.min(50, Math.max(1, options.pageSize));
  const searchQuery = options.query?.trim() ?? "";
  const start = (page - 1) * pageSize;

  const activeObjectIds = [...activePlayerIds].map((playerId) => new Types.ObjectId(playerId));
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
        gameIds: { $addToSet: "$gameId" },
      },
    },
  ];

  if (activeObjectIds.length > 0) {
    pipeline.push({ $match: { _id: { $nin: activeObjectIds } } });
  }

  if (searchQuery) {
    const regex = escapeRegexLiteral(searchQuery);
    pipeline.push(
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
        $addFields: {
          searchableText: {
            $concat: [
              { $ifNull: ["$player.firstName", ""] },
              " ",
              { $ifNull: ["$player.lastName", ""] },
              " ",
              { $ifNull: ["$player.email", ""] },
              " ",
              { $ifNull: ["$player.mobileNumber", ""] },
            ],
          },
        },
      },
      {
        $match: {
          searchableText: { $regex: regex, $options: "i" },
        },
      },
      {
        $project: {
          player: 0,
          searchableText: 0,
        },
      },
    );
  }

  pipeline.push(
    { $sort: { lastRegisteredAt: -1 } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: start }, { $limit: pageSize }],
      },
    },
  );

  const [facetResult] = await QueueEntry.aggregate<{
    metadata: Array<{ total: number }>;
    data: RosterGroupRow[];
  }>(pipeline);

  const total = facetResult?.metadata[0]?.total ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const rows = await hydrateRosterPageRows(gameId, facetResult?.data ?? []);

  return {
    rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

async function hydrateRosterPageRows(
  gameId: string,
  groupRows: RosterGroupRow[],
): Promise<DatabaseCheckInRosterRow[]> {
  if (groupRows.length === 0) return [];

  const pagePlayerIds = groupRows.map((row) => row._id);
  const [playerDocs, sessionEntries] = await Promise.all([
    Player.find({ _id: { $in: pagePlayerIds } })
      .select(
        "firstName lastName email mobileNumber personalQrCode photoUrl photoPublicId welcomeEmailStatus welcomeEmailError welcomeEmailSentAt",
      )
      .lean<
        Array<{
          _id: Types.ObjectId;
          firstName?: string;
          lastName?: string;
          email?: string;
          mobileNumber?: string;
          personalQrCode?: string;
          photoUrl?: string | null;
          photoPublicId?: string | null;
          welcomeEmailStatus?: string;
          welcomeEmailError?: string;
          welcomeEmailSentAt?: Date | null;
        }>
      >(),
    QueueEntry.find({
      gameId,
      playerId: { $in: pagePlayerIds },
    })
      .sort({ registeredAt: -1 })
      .select("_id playerId status removedFromSession")
      .lean<
        Array<{
          _id: Types.ObjectId;
          playerId: Types.ObjectId;
          status: string;
          removedFromSession?: boolean;
        }>
      >(),
  ]);

  const playerById = new Map(playerDocs.map((player) => [player._id.toString(), player]));
  const sessionEntryByPlayerId = new Map<
    string,
    { _id: Types.ObjectId; status: string; removedFromSession?: boolean }
  >();
  for (const entry of sessionEntries) {
    const playerId = entry.playerId.toString();
    if (sessionEntryByPlayerId.has(playerId)) continue;
    sessionEntryByPlayerId.set(playerId, {
      _id: entry._id,
      status: entry.status,
      removedFromSession: entry.removedFromSession,
    });
  }

  return groupRows.flatMap((groupRow) => {
    const player = playerById.get(groupRow._id.toString());
    if (!player) return [];

    const sessionEntry = sessionEntryByPlayerId.get(groupRow._id.toString());
    return [
      {
        ...groupRow,
        player,
        sessionQueueEntry: sessionEntry
          ? [
              {
                _id: sessionEntry._id,
                status: sessionEntry.status,
                removedFromSession: sessionEntry.removedFromSession,
              },
            ]
          : [],
      },
    ];
  });
}

async function getActiveSessionPlayerIds(gameId: string) {
  const playerIds = await QueueEntry.distinct("playerId", {
    gameId,
    status: { $in: ACTIVE_SESSION_QUEUE_STATUSES },
  });
  return new Set(playerIds.map((id) => id.toString()));
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

export async function getDatabaseCheckInPlayersForGame(
  ownerId: string,
  gameId: string,
  options: { page?: number; pageSize?: number; query?: string } = {},
): Promise<DatabaseCheckInPlayersPage> {
  await connectToDatabase();

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));

  const [ownerGames, blockedEmails, activePlayerIds] = await Promise.all([
    PickleGame.find({ ownerId }).select("gameId").lean<Array<{ gameId: string }>>(),
    getBlockedEmailsForOrganizer(ownerId),
    getActiveSessionPlayerIds(gameId),
  ]);

  const ownerGameIds = ownerGames.map((entry) => entry.gameId);
  if (!ownerGameIds.includes(gameId)) {
    throw new Error("Game not found.");
  }

  if (ownerGameIds.length === 0) {
    return {
      players: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
    };
  }

  const roster = await queryDatabaseCheckInRoster(ownerGameIds, activePlayerIds, gameId, {
    page,
    pageSize,
    query: options.query,
  });

  return {
    players: roster.rows.map((row) => mapRosterRowToCheckInItem(row, blockedEmails)),
    total: roster.total,
    page: roster.page,
    pageSize: roster.pageSize,
    totalPages: roster.totalPages,
  };
}

async function reactivateCheckedOutEntry(gameId: string, playerId: string) {
  const playerObjectId = new Types.ObjectId(playerId);
  const [checkedOutEntry, alreadyQueued, lastQueued] = await Promise.all([
    QueueEntry.findOne({
      gameId,
      playerId: playerObjectId,
      status: "checked_out",
    }).select("_id"),
    QueueEntry.findOne({
      gameId,
      status: "queued",
      playerId: playerObjectId,
    }).select("_id"),
    QueueEntry.findOne({ gameId, status: "queued" })
      .sort({ registeredAt: -1 })
      .select("registeredAt")
      .lean<{ registeredAt?: Date } | null>(),
  ]);

  if (!checkedOutEntry) {
    throw new Error("Checked-out player not found.");
  }
  if (alreadyQueued) {
    throw new Error("Player is already in the queue.");
  }

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
        removedFromSession: false,
        registeredAt,
      },
    },
    { returnDocument: "after" },
  );

  if (!entry) {
    throw new Error("Checked-out player not found.");
  }
}

export async function operatorCheckInPlayerFromDatabase(
  ownerId: string,
  gameId: string,
  playerId: string,
) {
  await connectToDatabase();

  const playerObjectId = new Types.ObjectId(playerId);
  const [game, ownerGames, player, queueStatus] = await Promise.all([
    PickleGame.findOne({ gameId, ownerId }).select("gameId status").lean(),
    PickleGame.find({ ownerId }).select("gameId").lean<Array<{ gameId: string }>>(),
    Player.findById(playerId)
      .select("firstName lastName email")
      .lean<{ _id: Types.ObjectId; firstName?: string; lastName?: string; email?: string } | null>(),
    getPlayerQueueStatusForGame(gameId, playerId),
  ]);

  if (!game) {
    throw new Error("Game not found.");
  }
  if (game.status === "ended") {
    throw new Error("Open play has ended. Reset the game to restart.");
  }
  if (!player) {
    throw new Error("Player not found.");
  }

  const ownerGameIds = ownerGames.map((entry) => entry.gameId);
  const inRoster = await isPlayerInOwnerRoster(ownerGameIds, playerObjectId);
  if (!inRoster) {
    throw new Error("Player not found in your registration list.");
  }

  const name = formatPlayerDisplayName(player.firstName ?? "", player.lastName ?? "") || "Player";

  if (queueStatus === "active") {
    throw new RegistrationLimitError(ALREADY_REGISTERED_MESSAGE, 409, {
      playerId,
      alreadyRegistered: true,
    });
  }

  if (queueStatus === "checked_out") {
    await reactivateCheckedOutEntry(gameId, playerId);
    return {
      message: `${name} checked back in at the end of the queue.`,
      playerId,
    };
  }

  await assertGameRegistrationAllowed(gameId, { email: player.email ?? undefined });

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
  };
}
