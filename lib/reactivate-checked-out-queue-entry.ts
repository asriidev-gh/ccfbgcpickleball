import { Types } from "mongoose";

import {
  clusterQueuedLockInGroups,
  getLockInGroupIdByPlayerIds,
} from "@/lib/lock-in-groups";
import { QueueEntry } from "@/models/QueueEntry";

/** Puts a checked-out or session-removed player back at the end of the queue. */
export async function tryReactivateCheckedOutQueueEntry(
  gameId: string,
  playerId: string,
): Promise<boolean> {
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
    return false;
  }
  if (alreadyQueued) {
    throw new Error("Player is already in the queue.");
  }

  const baseTime = lastQueued?.registeredAt
    ? new Date(lastQueued.registeredAt).getTime()
    : Date.now();
  const registeredAt = new Date(baseTime + 1000);

  const lockInByPlayer = await getLockInGroupIdByPlayerIds(gameId, [playerObjectId]);
  const lockInGroupId = lockInByPlayer.get(String(playerObjectId)) ?? null;

  const entry = await QueueEntry.findOneAndUpdate(
    { _id: checkedOutEntry._id, gameId, status: "checked_out" },
    {
      $set: {
        status: "queued",
        queueType: "normal",
        pairGroupId: null,
        lockInGroupId,
        removedFromSession: false,
        registeredAt,
      },
    },
    { returnDocument: "after" },
  );

  if (!entry) {
    return false;
  }

  await clusterQueuedLockInGroups(gameId);
  return true;
}
