import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import type { PrayerRequestItem, PrayerRequestView, PrayerRequestAction } from "@/lib/owner-prayer-requests-shared";
import { MAX_PRAYER_REQUEST_LENGTH, MIN_PRAYER_REQUEST_LENGTH } from "@/lib/owner-prayer-requests-shared";
import {
  countPrayerRepliesByRequestIds,
  createOwnerPrayerReply,
  listPrayerRepliesForRequest,
} from "@/lib/owner-prayer-replies";
import { PRAYER_ACKNOWLEDGE_REPLY_TEXT } from "@/lib/owner-prayer-replies-shared";
import type { PrayerReplyItem } from "@/lib/owner-prayer-replies-shared";
import { formatPlayerTableName } from "@/lib/utils";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { PrayerRequest } from "@/models/PrayerRequest";
import { PrayerRequestReply } from "@/models/PrayerRequestReply";
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
  photoUrl?: string | null;
  photoPublicId?: string | null;
};

type PrayerRequestDoc = {
  _id: { toString(): string };
  playerId: { toString(): string };
  gameId: string;
  requestText: string;
  status: string;
  submittedAt: Date;
  updatedAt: Date;
  playerViewedAt?: Date | null;
};

const unviewedByPlayerFilter = {
  $or: [{ playerViewedAt: null }, { playerViewedAt: { $exists: false } }],
};

async function resolveSpectatePlayerPrayerRequest(ownerId: string, playerId: string) {
  await connectToDatabase();

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const playerObjectId = new mongoose.Types.ObjectId(playerId);

  const pendingRequests = (await PrayerRequest.find({
    ownerId: ownerObjectId,
    playerId: playerObjectId,
    status: "pending",
  })
    .sort({ updatedAt: -1, submittedAt: -1 })
    .lean()) as PrayerRequestDoc[];

  if (pendingRequests.length > 0) {
    return pendingRequests[0];
  }

  const activeRequests = (await PrayerRequest.find({
    ownerId: ownerObjectId,
    playerId: playerObjectId,
    status: "acknowledged",
    ...unviewedByPlayerFilter,
  })
    .sort({ updatedAt: -1, submittedAt: -1 })
    .lean()) as PrayerRequestDoc[];

  if (activeRequests.length === 0) {
    return null;
  }

  let request = activeRequests[0];
  const latestReply = await PrayerRequestReply.findOne({
    ownerId: ownerObjectId,
    playerId: playerObjectId,
  })
    .sort({ createdAt: -1 })
    .select("prayerRequestId")
    .lean<{ prayerRequestId: { toString(): string } }>();

  const latestReplyRequestId = latestReply?.prayerRequestId.toString();
  if (latestReplyRequestId) {
    const matched = activeRequests.find((doc) => doc._id.toString() === latestReplyRequestId);
    if (matched) {
      request = matched;
    }
  }

  return request;
}

function matchesSearch(
  item: Pick<PrayerRequestItem, "name" | "firstName" | "lastName" | "email" | "mobileNumber" | "requestText">,
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    item.name,
    item.firstName,
    item.lastName,
    item.email,
    item.mobileNumber,
    item.requestText,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

export async function createPrayerRequestFromRegistration(
  gameId: string,
  playerId: string,
  requestText: string,
) {
  const trimmed = requestText.trim().slice(0, MAX_PRAYER_REQUEST_LENGTH);
  if (!trimmed || trimmed.length < MIN_PRAYER_REQUEST_LENGTH) return null;

  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId: { toString(): string } }>();
  if (!game?.ownerId) return null;

  return PrayerRequest.create({
    ownerId: new mongoose.Types.ObjectId(String(game.ownerId)),
    playerId: new mongoose.Types.ObjectId(playerId),
    gameId,
    requestText: trimmed,
    status: "pending",
    submittedAt: new Date(),
  });
}

export async function getOwnerPrayerRequests(
  ownerId: string,
  query = "",
  view: PrayerRequestView = "pending",
) {
  await connectToDatabase();

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const ownerGames = await PickleGame.find({ ownerId: ownerObjectId })
    .select("gameId")
    .lean<Array<{ gameId: string }>>();
  if (ownerGames.length === 0) {
    return { requests: [] as PrayerRequestItem[], total: 0, view };
  }

  const ownerGameIds = ownerGames.map((game) => game.gameId);
  const status = view === "acknowledged" ? "acknowledged" : "pending";
  const prayerDocs = (await PrayerRequest.find({
    ownerId: ownerObjectId,
    status,
    gameId: { $in: ownerGameIds },
  })
    .sort(view === "acknowledged" ? { updatedAt: -1 } : { submittedAt: -1 })
    .lean()) as PrayerRequestDoc[];

  if (prayerDocs.length === 0) {
    return { requests: [], total: 0, view };
  }

  const playerIds = [...new Set(prayerDocs.map((doc) => doc.playerId.toString()))];
  const playerObjectIds = playerIds.map((id) => new mongoose.Types.ObjectId(id));
  const entryAgg = (await QueueEntry.aggregate([
    { $match: { gameId: { $in: ownerGameIds }, playerId: { $in: playerObjectIds } } },
    {
      $group: {
        _id: "$playerId",
        gameIds: { $addToSet: "$gameId" },
        lastRegisteredAt: { $max: "$registeredAt" },
      },
    },
  ])) as PlayerEntryAgg[];

  const entryByPlayerId = new Map(entryAgg.map((row) => [row._id.toString(), row]));
  const playerDocs = (await Player.find({ _id: { $in: playerObjectIds } })
    .select("firstName lastName email mobileNumber photoUrl photoPublicId")
    .lean()) as PlayerDoc[];
  const playerById = new Map(playerDocs.map((doc) => [doc._id.toString(), doc]));

  const requests: PrayerRequestItem[] = [];
  const replyCounts = await countPrayerRepliesByRequestIds(
    prayerDocs.map((doc) => doc._id.toString()),
  );

  for (const doc of prayerDocs) {
    const playerId = doc.playerId.toString();
    const player = playerById.get(playerId);
    if (!player) continue;

    const entry = entryByPlayerId.get(playerId);
    const name = formatPlayerTableName(player.firstName ?? "", player.lastName ?? "") || "—";
    const item: PrayerRequestItem = {
      id: doc._id.toString(),
      playerId,
      name,
      firstName: player.firstName ?? "",
      lastName: player.lastName ?? "",
      email: player.email ?? "—",
      mobileNumber: player.mobileNumber ?? "—",
      photoUrl: player.photoUrl,
      photoPublicId: player.photoPublicId,
      requestText: doc.requestText,
      gameId: doc.gameId,
      sessionCount: entry?.gameIds?.length ?? 1,
      submittedAt: new Date(doc.submittedAt).toISOString(),
      acknowledgedAt:
        doc.status === "acknowledged" ? new Date(doc.updatedAt).toISOString() : null,
      lastRegisteredAt: entry?.lastRegisteredAt
        ? new Date(entry.lastRegisteredAt).toISOString()
        : null,
      replyCount: replyCounts.get(doc._id.toString()) ?? 0,
      status: doc.status as PrayerRequestItem["status"],
    };

    if (matchesSearch(item, query)) {
      requests.push(item);
    }
  }

  return { requests, total: requests.length, view };
}

export async function countOwnerPendingPrayerRequests(ownerId: string) {
  const { total } = await getOwnerPrayerRequests(ownerId, "", "pending");
  return total;
}

export async function resolveOwnerPrayerRequest(
  ownerId: string,
  requestId: string,
  action: PrayerRequestAction,
) {
  await connectToDatabase();

  if (action === "delete") {
    const request = await PrayerRequest.findOne({
      _id: requestId,
      ownerId: new mongoose.Types.ObjectId(ownerId),
      status: "acknowledged",
    });
    if (!request) {
      throw new Error("Acknowledged prayer request not found.");
    }

    await PrayerRequestReply.deleteMany({ prayerRequestId: request._id });
    await PrayerRequest.deleteOne({ _id: request._id });

    return {
      id: requestId,
      status: "deleted" as const,
    };
  }

  const request = await PrayerRequest.findOne({
    _id: requestId,
    ownerId: new mongoose.Types.ObjectId(ownerId),
    status: "pending",
  });
  if (!request) {
    throw new Error("Prayer request not found.");
  }

  request.status = "acknowledged";
  await request.save();

  await createOwnerPrayerReply(ownerId, requestId, PRAYER_ACKNOWLEDGE_REPLY_TEXT);

  return {
    id: request._id.toString(),
    status: request.status,
  };
}

export async function getSpectatePlayerPrayerStatus(ownerId: string, playerId: string) {
  const request = await resolveSpectatePlayerPrayerRequest(ownerId, playerId);

  if (!request) {
    return {
      hasRequest: false as const,
      requestText: "",
      status: null,
      submittedAt: null,
      replies: [] as PrayerReplyItem[],
      replyCount: 0,
    };
  }

  const replies = await listPrayerRepliesForRequest(request._id.toString());

  return {
    hasRequest: true as const,
    requestText: request.requestText,
    status: request.status as "pending" | "acknowledged" | "dismissed",
    submittedAt: new Date(request.submittedAt).toISOString(),
    replies,
    replyCount: replies.length,
  };
}

export async function markSpectatePlayerPrayerViewed(ownerId: string, playerId: string) {
  await connectToDatabase();

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const playerObjectId = new mongoose.Types.ObjectId(playerId);

  const result = await PrayerRequest.updateMany(
    {
      ownerId: ownerObjectId,
      playerId: playerObjectId,
      status: "acknowledged",
      ...unviewedByPlayerFilter,
    },
    { $set: { playerViewedAt: new Date() } },
  );

  return { marked: result.modifiedCount > 0 };
}
