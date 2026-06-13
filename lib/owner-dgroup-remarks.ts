import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import type { DgroupRemarkItem } from "@/lib/owner-dgroup-remarks-shared";
import { OwnerDgroupAcknowledgment } from "@/models/OwnerDgroupAcknowledgment";
import { OwnerDgroupRemark } from "@/models/OwnerDgroupRemark";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

type RemarkDoc = {
  _id: { toString(): string };
  text: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function assertOwnerCanManageDgroupPlayer(ownerId: string, playerId: string) {
  await connectToDatabase();

  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
  const ownerGames = await PickleGame.find({ ownerId: ownerObjectId }).select("gameId").lean<Array<{ gameId: string }>>();
  if (ownerGames.length === 0) {
    throw new Error("No games found for this organizer.");
  }

  const ownerGameIds = ownerGames.map((game) => game.gameId);
  const hasEntry = await QueueEntry.exists({
    playerId: new mongoose.Types.ObjectId(playerId),
    gameId: { $in: ownerGameIds },
  });
  if (!hasEntry) {
    throw new Error("Player not found in your registered players.");
  }

  const player = await Player.findById(playerId).select("_id wantsToJoinDgroup isPartOfDgroup");
  if (!player) throw new Error("Player not found.");

  return { ownerObjectId, player };
}

function mapRemark(doc: RemarkDoc): DgroupRemarkItem {
  return {
    id: doc._id.toString(),
    text: doc.text,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function listOwnerDgroupRemarks(ownerId: string, playerId: string) {
  await assertOwnerCanManageDgroupPlayer(ownerId, playerId);

  const remarks = (await OwnerDgroupRemark.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: new mongoose.Types.ObjectId(playerId),
  })
    .sort({ createdAt: -1 })
    .lean()) as RemarkDoc[];

  return remarks.map(mapRemark);
}

export async function createOwnerDgroupRemark(ownerId: string, playerId: string, text: string) {
  await assertOwnerCanManageDgroupPlayer(ownerId, playerId);

  const created = await OwnerDgroupRemark.create({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: new mongoose.Types.ObjectId(playerId),
    text: text.trim(),
  });

  return mapRemark(created as unknown as RemarkDoc);
}

export async function updateOwnerDgroupRemark(
  ownerId: string,
  playerId: string,
  remarkId: string,
  text: string,
) {
  await assertOwnerCanManageDgroupPlayer(ownerId, playerId);

  const remark = await OwnerDgroupRemark.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(remarkId),
      ownerId: new mongoose.Types.ObjectId(ownerId),
      playerId: new mongoose.Types.ObjectId(playerId),
    },
    { $set: { text: text.trim() } },
    { new: true },
  ).lean();

  if (!remark) throw new Error("Remark not found.");
  return mapRemark(remark as RemarkDoc);
}

export async function deleteOwnerDgroupRemark(ownerId: string, playerId: string, remarkId: string) {
  await assertOwnerCanManageDgroupPlayer(ownerId, playerId);

  const result = await OwnerDgroupRemark.deleteOne({
    _id: new mongoose.Types.ObjectId(remarkId),
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: new mongoose.Types.ObjectId(playerId),
  });

  if (result.deletedCount === 0) throw new Error("Remark not found.");
  return { ok: true };
}

export async function acknowledgeOwnerDgroupRequest(ownerId: string, playerId: string) {
  const { player } = await assertOwnerCanManageDgroupPlayer(ownerId, playerId);
  if (player.wantsToJoinDgroup !== true) {
    throw new Error("This player is not on the D-group request list.");
  }

  await OwnerDgroupAcknowledgment.findOneAndUpdate(
    {
      ownerId: new mongoose.Types.ObjectId(ownerId),
      playerId: new mongoose.Types.ObjectId(playerId),
    },
    { $set: { acknowledgedAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  return { acknowledged: true };
}

export async function clearOwnerDgroupAcknowledgment(ownerId: string, playerId: string) {
  await OwnerDgroupAcknowledgment.deleteOne({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: new mongoose.Types.ObjectId(playerId),
  });
}

export async function getOwnerDgroupAcknowledgmentMap(ownerId: string, playerIds: string[]) {
  if (playerIds.length === 0) return new Map<string, string>();

  const rows = await OwnerDgroupAcknowledgment.find({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: { $in: playerIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("playerId acknowledgedAt")
    .lean<Array<{ playerId: { toString(): string }; acknowledgedAt: Date }>>();

  return new Map(rows.map((row) => [row.playerId.toString(), new Date(row.acknowledgedAt).toISOString()]));
}

export async function getOwnerDgroupRemarkCountMap(ownerId: string, playerIds: string[]) {
  if (playerIds.length === 0) return new Map<string, number>();

  const rows = (await OwnerDgroupRemark.aggregate([
    {
      $match: {
        ownerId: new mongoose.Types.ObjectId(ownerId),
        playerId: { $in: playerIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    { $group: { _id: "$playerId", count: { $sum: 1 } } },
  ])) as Array<{ _id: { toString(): string }; count: number }>;

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}

export async function isDgroupRequestAcknowledgedForOwner(ownerId: string, playerId: string) {
  await connectToDatabase();
  const exists = await OwnerDgroupAcknowledgment.exists({
    ownerId: new mongoose.Types.ObjectId(ownerId),
    playerId: new mongoose.Types.ObjectId(playerId),
  });
  return Boolean(exists);
}
