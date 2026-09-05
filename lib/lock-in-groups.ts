import { nanoid } from "nanoid";
import { Types } from "mongoose";

import {
  alignLockInPairsToPartnerSlots,
  LOCK_IN_MAX_PLAYERS,
  LOCK_IN_MIN_PLAYERS,
  type LockInGroupItem,
} from "@/lib/lock-in-groups-shared";
import { LockInGroup } from "@/models/LockInGroup";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

export {
  alignLockInPairsToPartnerSlots,
  keepLockInPartnersTogether,
  LOCK_IN_MAX_PLAYERS,
  LOCK_IN_MIN_PLAYERS,
  lockInPairsOccupyPartnerSlots,
  moveContiguousGroupBlock,
  type LockInGroupItem,
} from "@/lib/lock-in-groups-shared";

function persistQueueOrder(
  orderedEntries: Array<{ _id: Types.ObjectId; registeredAt?: Date }>,
) {
  if (orderedEntries.length === 0) return Promise.resolve();

  const baseTime =
    orderedEntries[0]?.registeredAt != null
      ? new Date(orderedEntries[0].registeredAt).getTime()
      : Date.now();

  return QueueEntry.bulkWrite(
    orderedEntries.map((entry, index) => ({
      updateOne: {
        filter: { _id: entry._id },
        update: { $set: { registeredAt: new Date(baseTime + index * 1000) } },
      },
    })),
    { ordered: false },
  );
}

/**
 * Reorder queued entries so each lock-in pair sits together on partner slots
 * (0–1, 2–3, …), preserving overall FIFO as much as possible.
 */
export async function clusterQueuedLockInGroups(gameId: string) {
  const [queued, groups] = await Promise.all([
    QueueEntry.find({
      gameId,
      status: "queued",
      removedFromSession: { $ne: true },
    })
      .sort({ registeredAt: 1 })
      .select("_id playerId lockInGroupId registeredAt")
      .lean<
        Array<{
          _id: Types.ObjectId;
          playerId: Types.ObjectId;
          lockInGroupId?: string | null;
          registeredAt: Date;
        }>
      >(),
    LockInGroup.find({ gameId })
      .select("groupId playerIds")
      .lean<Array<{ groupId: string; playerIds: Types.ObjectId[] }>>(),
  ]);

  if (queued.length === 0 || groups.length === 0) return;

  const playerToGroup = new Map<string, string>();
  for (const group of groups) {
    for (const playerId of group.playerIds) {
      playerToGroup.set(String(playerId), group.groupId);
    }
  }

  const lockInStamps = queued.flatMap((entry) => {
    const groupId = playerToGroup.get(String(entry.playerId)) ?? null;
    if ((entry.lockInGroupId ?? null) === groupId) return [];
    return [
      {
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { lockInGroupId: groupId } },
        },
      },
    ];
  });
  if (lockInStamps.length > 0) {
    await QueueEntry.bulkWrite(lockInStamps, { ordered: false });
  }

  const resolveGroupId = (entry: (typeof queued)[number]) =>
    entry.lockInGroupId || playerToGroup.get(String(entry.playerId)) || null;

  const emitted = new Set<string>();
  const ordered: typeof queued = [];

  for (const entry of queued) {
    const entryKey = String(entry._id);
    if (emitted.has(entryKey)) continue;

    const groupId = resolveGroupId(entry);
    if (!groupId) {
      ordered.push(entry);
      emitted.add(entryKey);
      continue;
    }

    const members = queued.filter((candidate) => {
      if (emitted.has(String(candidate._id))) return false;
      return resolveGroupId(candidate) === groupId;
    });

    for (const member of members) {
      ordered.push(member);
      emitted.add(String(member._id));
    }
  }

  const aligned = alignLockInPairsToPartnerSlots(ordered, resolveGroupId);
  await persistQueueOrder(aligned);
}

export async function getLockInGroupIdByPlayerIds(gameId: string, playerIds: Types.ObjectId[]) {
  if (playerIds.length === 0) return new Map<string, string>();

  const groups = await LockInGroup.find({
    gameId,
    playerIds: { $in: playerIds },
  })
    .select("groupId playerIds")
    .lean<Array<{ groupId: string; playerIds: Types.ObjectId[] }>>();

  const map = new Map<string, string>();
  for (const group of groups) {
    for (const playerId of group.playerIds) {
      map.set(String(playerId), group.groupId);
    }
  }
  return map;
}

export async function createLockInGroup(input: {
  gameId: string;
  playerIds: string[];
}) {
  const uniqueIds = [...new Set(input.playerIds.map(String))];
  if (uniqueIds.length < LOCK_IN_MIN_PLAYERS || uniqueIds.length > LOCK_IN_MAX_PLAYERS) {
    throw new Error("Select exactly 2 players to lock in as partners.");
  }

  const objectIds = uniqueIds.map((id) => new Types.ObjectId(id));

  const overlapping = await LockInGroup.findOne({
    gameId: input.gameId,
    playerIds: { $in: objectIds },
  })
    .select("groupId")
    .lean();
  if (overlapping) {
    throw new Error("One or more selected players are already in a lock-in group.");
  }

  const queuedCount = await QueueEntry.countDocuments({
    gameId: input.gameId,
    playerId: { $in: objectIds },
    status: { $in: ["queued", "on_court"] },
    removedFromSession: { $ne: true },
  });
  if (queuedCount < uniqueIds.length) {
    throw new Error("All selected players must be in this session queue or on court.");
  }

  const groupId = `LOCK-${nanoid(8)}`;
  await LockInGroup.create({
    gameId: input.gameId,
    groupId,
    playerIds: objectIds,
  });

  await QueueEntry.updateMany(
    {
      gameId: input.gameId,
      playerId: { $in: objectIds },
      removedFromSession: { $ne: true },
    },
    { $set: { lockInGroupId: groupId } },
  );

  await clusterQueuedLockInGroups(input.gameId);

  return groupId;
}

export async function deleteLockInGroup(gameId: string, groupId: string) {
  const deleted = await LockInGroup.findOneAndDelete({ gameId, groupId });
  if (!deleted) throw new Error("Lock-in group not found.");

  await QueueEntry.updateMany(
    { gameId, lockInGroupId: groupId },
    { $set: { lockInGroupId: null } },
  );
}

type PopulatedLockInPlayer = {
  _id?: Types.ObjectId;
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
  photoPublicId?: string | null;
};

function asPopulatedLockInPlayer(player: unknown): PopulatedLockInPlayer | null {
  if (player == null || typeof player !== "object" || player instanceof Types.ObjectId) {
    return null;
  }
  if (!("_id" in player)) return null;
  const doc = player as PopulatedLockInPlayer;
  return doc._id ? doc : null;
}

export async function listLockInGroups(gameId: string): Promise<LockInGroupItem[]> {
  const groups = await LockInGroup.find({ gameId })
    .sort({ createdAt: -1 })
    .populate({
      path: "playerIds",
      model: Player,
      select: "firstName lastName photoUrl photoPublicId",
    })
    .lean<
      Array<{
        groupId: string;
        createdAt?: Date;
        playerIds: unknown[];
      }>
    >();

  return groups.map((group) => {
    const players = (group.playerIds ?? []).flatMap((player) => {
      const doc = asPopulatedLockInPlayer(player);
      if (!doc?._id) return [];
      const firstName = doc.firstName ?? "";
      const lastName = doc.lastName ?? "";
      return [
        {
          id: String(doc._id),
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim() || "Player",
          photoUrl: doc.photoUrl,
          photoPublicId: doc.photoPublicId,
        },
      ];
    });

    return {
      groupId: group.groupId,
      playerIds: players.map((player) => player.id),
      players,
      createdAt: group.createdAt ? new Date(group.createdAt).toISOString() : null,
    };
  });
}
