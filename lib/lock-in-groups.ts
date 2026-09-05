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
  const baseTime =
    orderedEntries.length > 0 && orderedEntries[0]?.registeredAt
      ? new Date(orderedEntries[0].registeredAt).getTime()
      : Date.now();

  return Promise.all(
    orderedEntries.map((entry, index) =>
      QueueEntry.updateOne(
        { _id: entry._id },
        { $set: { registeredAt: new Date(baseTime + index * 1000) } },
      ),
    ),
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

  // Ensure queued rows carry the current lock-in id from the group docs.
  await Promise.all(
    queued.map((entry) => {
      const groupId = playerToGroup.get(String(entry.playerId)) ?? null;
      if ((entry.lockInGroupId ?? null) === groupId) return null;
      return QueueEntry.updateOne(
        { _id: entry._id },
        { $set: { lockInGroupId: groupId } },
      );
    }),
  );

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
        playerIds: Array<{
          _id?: Types.ObjectId;
          firstName?: string;
          lastName?: string;
          photoUrl?: string | null;
          photoPublicId?: string | null;
        } | Types.ObjectId | string>;
      }>
    >();

  return groups.map((group) => {
    const players = (group.playerIds ?? []).flatMap((player) => {
      if (player == null || typeof player !== "object" || !("_id" in player) || !player._id) {
        return [];
      }
      const firstName = player.firstName ?? "";
      const lastName = player.lastName ?? "";
      return [
        {
          id: String(player._id),
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim() || "Player",
          photoUrl: player.photoUrl,
          photoPublicId: player.photoPublicId,
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
