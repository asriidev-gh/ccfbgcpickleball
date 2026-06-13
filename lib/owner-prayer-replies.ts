import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import type { PrayerReplyItem } from "@/lib/owner-prayer-replies-shared";
import { MAX_PRAYER_REPLY_LENGTH } from "@/lib/owner-prayer-replies-shared";
import { PrayerRequest } from "@/models/PrayerRequest";
import { PrayerRequestReply } from "@/models/PrayerRequestReply";

type ReplyDoc = {
  _id: { toString(): string };
  text: string;
  createdAt: Date;
  updatedAt: Date;
};

type PrayerRequestDoc = {
  _id: { toString(): string };
  ownerId: { toString(): string };
  playerId: { toString(): string };
  requestText: string;
  status: string;
  submittedAt: Date;
};

function mapReply(doc: ReplyDoc): PrayerReplyItem {
  return {
    id: doc._id.toString(),
    text: doc.text,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function assertOwnerOwnsPrayerRequest(ownerId: string, requestId: string) {
  await connectToDatabase();

  const request = (await PrayerRequest.findOne({
    _id: requestId,
    ownerId: new mongoose.Types.ObjectId(ownerId),
  }).lean()) as PrayerRequestDoc | null;

  if (!request) {
    throw new Error("Prayer request not found.");
  }

  return request;
}

export async function listOwnerPrayerReplies(ownerId: string, requestId: string) {
  await assertOwnerOwnsPrayerRequest(ownerId, requestId);

  const replies = (await PrayerRequestReply.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    prayerRequestId: new mongoose.Types.ObjectId(requestId),
  })
    .sort({ createdAt: -1 })
    .lean()) as ReplyDoc[];

  return replies.map(mapReply);
}

export async function listPrayerRepliesForRequest(requestId: string) {
  await connectToDatabase();

  const replies = (await PrayerRequestReply.find({
    prayerRequestId: new mongoose.Types.ObjectId(requestId),
  })
    .sort({ createdAt: -1 })
    .lean()) as ReplyDoc[];

  return replies.map(mapReply);
}

export async function listPrayerRepliesForPlayer(ownerId: string, playerId: string) {
  await connectToDatabase();

  const replies = (await PrayerRequestReply.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: new mongoose.Types.ObjectId(playerId),
  })
    .sort({ createdAt: -1 })
    .lean()) as ReplyDoc[];

  return replies.map(mapReply);
}

export async function createOwnerPrayerReply(
  ownerId: string,
  requestId: string,
  text: string,
) {
  const request = await assertOwnerOwnsPrayerRequest(ownerId, requestId);
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error("Reply is required.");
  }
  if (trimmed.length > MAX_PRAYER_REPLY_LENGTH) {
    throw new Error(`Reply must be ${MAX_PRAYER_REPLY_LENGTH} characters or less.`);
  }

  const created = await PrayerRequestReply.create({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    prayerRequestId: new mongoose.Types.ObjectId(requestId),
    playerId: new mongoose.Types.ObjectId(request.playerId.toString()),
    text: trimmed,
  });

  let acknowledged = request.status === "acknowledged";
  if (request.status === "pending") {
    const updated = await PrayerRequest.updateOne(
      {
        _id: new mongoose.Types.ObjectId(requestId),
        ownerId: new mongoose.Types.ObjectId(ownerId),
        status: "pending",
      },
      { $set: { status: "acknowledged" } },
    );
    acknowledged = updated.modifiedCount > 0;
  }

  return {
    reply: mapReply(created as unknown as ReplyDoc),
    acknowledged,
  };
}

export async function countPrayerRepliesByRequestIds(requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, number>();

  await connectToDatabase();

  const objectIds = requestIds.map((id) => new mongoose.Types.ObjectId(id));
  const rows = await PrayerRequestReply.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { prayerRequestId: { $in: objectIds } } },
    { $group: { _id: "$prayerRequestId", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}
