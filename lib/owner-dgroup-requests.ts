import { connectToDatabase } from "@/lib/db";
import mongoose from "mongoose";
import type {
  DgroupRequestItem,
  DgroupRequestView,
} from "@/lib/owner-dgroup-requests-shared";
import {
  acknowledgeOwnerDgroupRequest,
  clearOwnerDgroupAcknowledgment,
  getOwnerDgroupAcknowledgmentMap,
  getOwnerDgroupRemarkCountMap,
} from "@/lib/owner-dgroup-remarks";
import { formatPlayerTableName } from "@/lib/utils";
import { OwnerDgroupJoinMark } from "@/models/OwnerDgroupJoinMark";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

type PlayerEntryAgg = {
  _id: { toString(): string };
  gameIds: string[];
  lastRegisteredAt?: Date;
};

type PlayerDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  mobileNumber?: string;
  personalQrCode?: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
  wantsToJoinDgroup?: boolean | null;
  isPartOfDgroup?: boolean;
  dgroupAvailableDays?: string[];
  dgroupAvailableTimeFrom?: string;
  dgroupAvailableTimeTo?: string;
  updatedAt?: Date;
  createdAt?: Date;
};

function matchesSearch(
  player: Pick<DgroupRequestItem, "name" | "firstName" | "lastName" | "email" | "mobileNumber">,
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    player.name,
    player.firstName,
    player.lastName,
    player.email,
    player.mobileNumber,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

async function getOwnerDgroupPlayerContext(ownerId: string) {
  const ownerGames = await PickleGame.find({ ownerId }).select("gameId").lean<Array<{ gameId: string }>>();
  if (ownerGames.length === 0) {
    return null;
  }

  const ownerGameIds = ownerGames.map((game) => game.gameId);
  const entryAgg = (await QueueEntry.aggregate([
    { $match: { gameId: { $in: ownerGameIds } } },
    {
      $group: {
        _id: "$playerId",
        gameIds: { $addToSet: "$gameId" },
        lastRegisteredAt: { $max: "$registeredAt" },
      },
    },
  ])) as PlayerEntryAgg[];

  if (entryAgg.length === 0) {
    return null;
  }

  return {
    entryByPlayerId: new Map(entryAgg.map((row) => [row._id.toString(), row])),
    playerIds: entryAgg.map((row) => row._id),
  };
}

function mapPlayerToRequestItem(
  doc: PlayerDoc,
  entry: PlayerEntryAgg,
  markedAt?: Date | null,
): DgroupRequestItem {
  const name = formatPlayerTableName(doc.firstName ?? "", doc.lastName ?? "") || "—";
  return {
    id: doc._id.toString(),
    name,
    firstName: doc.firstName ?? "",
    lastName: doc.lastName ?? "",
    email: doc.email ?? "—",
    mobileNumber: doc.mobileNumber ?? "—",
    photoUrl: doc.photoUrl,
    photoPublicId: doc.photoPublicId,
    personalQrCode: doc.personalQrCode,
    sessionCount: entry.gameIds?.length ?? 0,
    lastRegisteredAt: entry.lastRegisteredAt ? new Date(entry.lastRegisteredAt).toISOString() : null,
    requestedAt: markedAt
      ? new Date(markedAt).toISOString()
      : doc.updatedAt
        ? new Date(doc.updatedAt).toISOString()
        : doc.createdAt
          ? new Date(doc.createdAt).toISOString()
          : null,
    dgroupAvailableDays: doc.dgroupAvailableDays ?? [],
    dgroupAvailableTimeFrom: doc.dgroupAvailableTimeFrom?.trim() ?? "",
    dgroupAvailableTimeTo: doc.dgroupAvailableTimeTo?.trim() ?? "",
  };
}

async function getJoinedPlayerIds(ownerId: string, playerIds: unknown[]) {
  const marks = await OwnerDgroupJoinMark.find({
    ownerId,
    playerId: { $in: playerIds },
  })
    .select("playerId markedAt")
    .lean<Array<{ playerId: { toString(): string }; markedAt?: Date }>>();

  return new Map(marks.map((mark) => [mark.playerId.toString(), mark.markedAt ?? null]));
}

export async function getOwnerDgroupRequests(
  ownerId: string,
  query = "",
  view: DgroupRequestView = "pending",
  includeRegistrationDgroup = false,
) {
  await connectToDatabase();

  const context = await getOwnerDgroupPlayerContext(ownerId);
  if (!context) {
    return { requests: [] as DgroupRequestItem[], total: 0, view };
  }

  const { entryByPlayerId, playerIds } = context;

  if (view === "joined") {
    const joinedByPlayerId = await getJoinedPlayerIds(ownerId, playerIds);
    const joinedPlayerIdSet = new Set(joinedByPlayerId.keys());

    if (includeRegistrationDgroup) {
      const registrationDocs = (await Player.find({
        _id: { $in: playerIds },
        isPartOfDgroup: true,
      })
        .select("_id")
        .lean()) as Array<{ _id: { toString(): string } }>;

      for (const doc of registrationDocs) {
        joinedPlayerIdSet.add(doc._id.toString());
      }
    }

    if (joinedPlayerIdSet.size === 0) {
      return { requests: [], total: 0, view, includeRegistrationDgroup };
    }

    const joinedPlayerIds = [...joinedPlayerIdSet];
    const playerDocs = (await Player.find({ _id: { $in: joinedPlayerIds } })
      .select(
        "firstName lastName email mobileNumber personalQrCode photoUrl photoPublicId isPartOfDgroup dgroupAvailableDays dgroupAvailableTimeFrom dgroupAvailableTimeTo updatedAt createdAt",
      )
      .lean()) as PlayerDoc[];

    const requests: DgroupRequestItem[] = [];

    for (const doc of playerDocs) {
      const entry = entryByPlayerId.get(doc._id.toString());
      if (!entry) continue;

      const playerId = doc._id.toString();
      const isOwnerMarked = joinedByPlayerId.has(playerId);
      const item: DgroupRequestItem = {
        ...mapPlayerToRequestItem(
          doc,
          entry,
          isOwnerMarked ? joinedByPlayerId.get(playerId) : null,
        ),
        joinedSource: isOwnerMarked ? "owner_marked" : "registration",
      };

      if (matchesSearch(item, query)) {
        requests.push(item);
      }
    }

    requests.sort((a, b) => {
      if (a.joinedSource !== b.joinedSource) {
        return a.joinedSource === "owner_marked" ? -1 : 1;
      }
      const aTime =
        a.joinedSource === "owner_marked" && a.requestedAt
          ? new Date(a.requestedAt).getTime()
          : a.lastRegisteredAt
            ? new Date(a.lastRegisteredAt).getTime()
            : 0;
      const bTime =
        b.joinedSource === "owner_marked" && b.requestedAt
          ? new Date(b.requestedAt).getTime()
          : b.lastRegisteredAt
            ? new Date(b.lastRegisteredAt).getTime()
            : 0;
      return bTime - aTime;
    });

    return { requests, total: requests.length, view, includeRegistrationDgroup };
  }

  const joinedByPlayerId = await getJoinedPlayerIds(ownerId, playerIds);
  const playerDocs = (await Player.find({
    _id: { $in: playerIds },
    wantsToJoinDgroup: true,
    isPartOfDgroup: { $ne: true },
  })
    .select(
      "firstName lastName email mobileNumber personalQrCode photoUrl photoPublicId wantsToJoinDgroup isPartOfDgroup dgroupAvailableDays dgroupAvailableTimeFrom dgroupAvailableTimeTo updatedAt createdAt",
    )
    .lean()) as PlayerDoc[];

  const requests: DgroupRequestItem[] = [];

  const pendingPlayerIds = playerDocs.map((doc) => doc._id.toString());
  const [acknowledgmentByPlayerId, remarkCountByPlayerId] = await Promise.all([
    getOwnerDgroupAcknowledgmentMap(ownerId, pendingPlayerIds),
    getOwnerDgroupRemarkCountMap(ownerId, pendingPlayerIds),
  ]);

  for (const doc of playerDocs) {
    if (joinedByPlayerId.has(doc._id.toString())) continue;

    const entry = entryByPlayerId.get(doc._id.toString());
    if (!entry) continue;

    const playerId = doc._id.toString();
    const acknowledgedAt = acknowledgmentByPlayerId.get(playerId) ?? null;
    const item: DgroupRequestItem = {
      ...mapPlayerToRequestItem(doc, entry),
      isAcknowledged: Boolean(acknowledgedAt),
      acknowledgedAt,
      remarkCount: remarkCountByPlayerId.get(playerId) ?? 0,
    };
    if (matchesSearch(item, query)) {
      requests.push(item);
    }
  }

  requests.sort((a, b) => {
    const aTime = a.lastRegisteredAt ? new Date(a.lastRegisteredAt).getTime() : 0;
    const bTime = b.lastRegisteredAt ? new Date(b.lastRegisteredAt).getTime() : 0;
    return bTime - aTime;
  });

  return { requests, total: requests.length, view };
}

export async function resolveOwnerDgroupRequest(
  ownerId: string,
  playerId: string,
  action: "mark_joined" | "acknowledge" | "unmark_joined",
) {
  await connectToDatabase();

  const ownerGames = await PickleGame.find({ ownerId }).select("gameId").lean<Array<{ gameId: string }>>();
  if (ownerGames.length === 0) {
    throw new Error("No games found for this organizer.");
  }

  const ownerGameIds = ownerGames.map((game) => game.gameId);
  const hasEntry = await QueueEntry.exists({
    playerId,
    gameId: { $in: ownerGameIds },
  });
  if (!hasEntry) {
    throw new Error("Player not found in your registered players.");
  }

  const player = await Player.findById(playerId);
  if (!player) throw new Error("Player not found.");

  if (action === "mark_joined") {
    if (player.wantsToJoinDgroup !== true) {
      throw new Error("This player is not on the D-group request list.");
    }

    player.isPartOfDgroup = true;
    player.wantsToJoinDgroup = null;
    player.dgroupAvailableDays = [];
    player.dgroupAvailableTimeFrom = "";
    player.dgroupAvailableTimeTo = "";
    await player.save();

    await OwnerDgroupJoinMark.findOneAndUpdate(
      { ownerId, playerId },
      { $set: { markedAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    await clearOwnerDgroupAcknowledgment(ownerId, playerId);
  } else if (action === "unmark_joined") {
    const existingMark = await OwnerDgroupJoinMark.findOne({ ownerId, playerId });
    if (!existingMark) {
      throw new Error("This player was not marked as joined from your D-group request list.");
    }

    await OwnerDgroupJoinMark.deleteOne({ ownerId, playerId });

    player.isPartOfDgroup = false;
    player.wantsToJoinDgroup = true;
    await player.save();
    await clearOwnerDgroupAcknowledgment(ownerId, playerId);
  } else {
    await acknowledgeOwnerDgroupRequest(ownerId, playerId);
  }

  return {
    id: player._id.toString(),
    isPartOfDgroup: player.isPartOfDgroup ?? false,
    wantsToJoinDgroup: player.wantsToJoinDgroup ?? null,
  };
}

export async function countOwnerDgroupRequests(ownerId: string) {
  const { total } = await getOwnerDgroupRequests(ownerId, "", "pending");
  return total;
}

export async function isOwnerMarkedDgroupJoined(ownerId: string, playerId: string) {
  await connectToDatabase();
  const exists = await OwnerDgroupJoinMark.exists({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: new mongoose.Types.ObjectId(playerId),
  });
  return Boolean(exists);
}
