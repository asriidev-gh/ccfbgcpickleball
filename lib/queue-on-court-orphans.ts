import { Types } from "mongoose";

import { Court } from "@/models/Court";
import { QueueEntry } from "@/models/QueueEntry";

export type HealedOnCourtOrphan = {
  entryId: string;
  playerId: string;
};

/**
 * Queue entries stuck as `on_court` but not referenced by any court assignment.
 * These players vanish from the live queue and are treated as already registered
 * for database check-in until repaired.
 */
export async function findOrphanedOnCourtEntryIds(gameId: string): Promise<Types.ObjectId[]> {
  const [onCourtEntries, courts] = await Promise.all([
    QueueEntry.find({ gameId, status: "on_court" })
      .select("_id")
      .lean<Array<{ _id: Types.ObjectId }>>(),
    Court.find({ gameId })
      .select("teamA.queueEntryIds teamB.queueEntryIds")
      .lean<
        Array<{
          teamA?: { queueEntryIds?: Types.ObjectId[] };
          teamB?: { queueEntryIds?: Types.ObjectId[] };
        }>
      >(),
  ]);

  if (onCourtEntries.length === 0) return [];

  const assignedEntryIds = new Set<string>();
  for (const court of courts) {
    for (const entryId of court.teamA?.queueEntryIds ?? []) {
      assignedEntryIds.add(String(entryId));
    }
    for (const entryId of court.teamB?.queueEntryIds ?? []) {
      assignedEntryIds.add(String(entryId));
    }
  }

  return onCourtEntries
    .filter((entry) => !assignedEntryIds.has(String(entry._id)))
    .map((entry) => entry._id);
}

/**
 * Return orphaned `on_court` entries to the queue so they reappear in the player list.
 * Safe to call on every queue load; no-ops when nothing is orphaned.
 */
export async function healOrphanedOnCourtEntries(gameId: string): Promise<HealedOnCourtOrphan[]> {
  const orphanIds = await findOrphanedOnCourtEntryIds(gameId);
  if (orphanIds.length === 0) return [];

  const orphans = await QueueEntry.find({
    _id: { $in: orphanIds },
    gameId,
    status: "on_court",
  })
    .select("_id playerId")
    .lean<Array<{ _id: Types.ObjectId; playerId: Types.ObjectId }>>();

  if (orphans.length === 0) return [];

  const result = await QueueEntry.updateMany(
    {
      _id: { $in: orphans.map((entry) => entry._id) },
      gameId,
      status: "on_court",
    },
    {
      $set: {
        status: "queued",
        queueType: "normal",
        pairGroupId: null,
      },
    },
  );

  if ((result.modifiedCount ?? 0) === 0) return [];

  return orphans.map((entry) => ({
    entryId: String(entry._id),
    playerId: String(entry.playerId),
  }));
}
