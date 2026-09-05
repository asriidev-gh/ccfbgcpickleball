import { nanoid } from "nanoid";
import { Types } from "mongoose";

import { appendDoublesRequeueEntries } from "@/lib/doubles/doubles-queue-fill";
import { isDoublesWinnerLoserRotation } from "@/lib/doubles/doubles-queue-fill";
import { orderMixedDoublesRequeueEntries } from "@/lib/doubles/mixed-doubles-requeue";
import type { GameFormatSettings } from "@/lib/game-format-settings";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { toQueueEntryViewForPick, type QueueEntryLike } from "@/lib/queue-court-assignment";
import {
  clusterQueuedLockInGroups,
  getLockInGroupIdByPlayerIds,
  keepLockInPartnersTogether,
} from "@/lib/lock-in-groups";
import { clusterQueuedLockInPairs } from "@/lib/lock-in-groups-shared";
import { isMixedDoublesMatching } from "@/lib/quick-play-wizard-shared";
import {
  isSinglesWinnerLoserRotation,
  rebuildSinglesQueueOrder,
} from "@/lib/singles/singles-queue-fill";
import { QueueEntry } from "@/models/QueueEntry";

type CourtDoc = {
  teamA: { playerIds: Types.ObjectId[]; queueEntryIds: Types.ObjectId[] };
  teamB: { playerIds: Types.ObjectId[]; queueEntryIds: Types.ObjectId[] };
};

async function persistQueueOrder(
  orderedEntries: Array<{ _id: Types.ObjectId; registeredAt: Date }>,
) {
  const baseTime =
    orderedEntries.length > 0
      ? new Date(orderedEntries[0].registeredAt).getTime()
      : Date.now();

  if (orderedEntries.length === 0) return;
  await QueueEntry.bulkWrite(
    orderedEntries.map((entry, index) => ({
      updateOne: {
        filter: { _id: entry._id },
        update: { $set: { registeredAt: new Date(baseTime + index * 1000) } },
      },
    })),
    { ordered: false },
  );
}

function crossRequeuePlayerOrder(
  teamAPlayerIds: Types.ObjectId[],
  teamBPlayerIds: Types.ObjectId[],
) {
  return [teamAPlayerIds[0], teamBPlayerIds[0], teamAPlayerIds[1], teamBPlayerIds[1]].filter(
    Boolean,
  ) as Types.ObjectId[];
}

function queuePlayerIdKey(playerId: unknown) {
  if (typeof playerId === "string") return playerId;
  if (playerId instanceof Types.ObjectId) return playerId.toString();
  if (playerId && typeof playerId === "object" && "_id" in playerId) {
    const id = (playerId as { _id?: unknown })._id;
    if (id != null) return String(id);
  }
  return String(playerId);
}

/** Keep waiting players in place and append finished-court players in W/L/W/L order. */
async function persistFinishedPlayersAtQueueTail(
  gameId: string,
  finishedPlayerOrder: Types.ObjectId[],
) {
  if (finishedPlayerOrder.length === 0) return;

  const queued = await QueueEntry.find({ gameId, status: "queued" }).sort({
    registeredAt: 1,
  });
  const finishedSet = new Set(finishedPlayerOrder.map((id) => id.toString()));
  const waiting = queued.filter((entry) => !finishedSet.has(queuePlayerIdKey(entry.playerId)));
  const requeuedByPlayerId = new Map<string, (typeof queued)[number]>();
  for (const entry of queued) {
    const key = queuePlayerIdKey(entry.playerId);
    if (finishedSet.has(key)) requeuedByPlayerId.set(key, entry);
  }
  const tail = finishedPlayerOrder
    .map((playerId) => requeuedByPlayerId.get(playerId.toString()))
    .filter((entry): entry is (typeof queued)[number] => entry != null);
  if (tail.length !== finishedPlayerOrder.length) return;
  await persistQueueOrder(clusterQueuedLockInPairs([...waiting, ...tail]));
}

async function markCourtEntriesDone(court: CourtDoc) {
  await QueueEntry.updateMany(
    { _id: { $in: [...court.teamA.queueEntryIds, ...court.teamB.queueEntryIds] } },
    { $set: { status: "done" } },
  );
}

async function clearStaleQueuedEntriesForPlayers(
  gameId: string,
  playerIds: Types.ObjectId[],
) {
  if (playerIds.length === 0) return;
  await QueueEntry.updateMany(
    {
      gameId,
      playerId: { $in: playerIds },
      status: "queued",
    },
    { $set: { status: "done" } },
  );
}

async function insertRequeueEntries(
  gameId: string,
  specs: Array<{
    playerId: Types.ObjectId;
    queueType: "normal" | "winner" | "loser";
    pairGroupId?: string | null;
    lockInGroupId?: string | null;
    registeredAt: Date;
    lastMatchResult: "win" | "loss";
  }>,
  options?: { clusterLockInGroups?: boolean },
) {
  if (specs.length === 0) return;
  await clearStaleQueuedEntriesForPlayers(
    gameId,
    specs.map((spec) => spec.playerId),
  );

  const needsLockInLookup = specs.some((spec) => spec.lockInGroupId == null);
  const lockInByPlayer = needsLockInLookup
    ? await getLockInGroupIdByPlayerIds(
        gameId,
        specs.map((spec) => spec.playerId),
      )
    : new Map<string, string>();

  await QueueEntry.insertMany(
    specs.map((spec) => ({
      gameId,
      playerId: spec.playerId,
      status: "queued",
      queueType: spec.queueType,
      pairGroupId: spec.pairGroupId ?? null,
      lockInGroupId:
        spec.lockInGroupId ?? lockInByPlayer.get(String(spec.playerId)) ?? null,
      registeredAt: spec.registeredAt,
      lastMatchResult: spec.lastMatchResult,
      winStreak: spec.lastMatchResult === "win" ? 1 : 0,
    })),
  );

  if (options?.clusterLockInGroups !== false) {
    await clusterQueuedLockInGroups(gameId);
  }
}

async function requeueSinglesCourt(input: {
  gameId: string;
  court: CourtDoc;
  winnerTeam: "A" | "B";
  format: GameFormatSettings;
}) {
  const teamAPlayerIds = [...input.court.teamA.playerIds];
  const teamBPlayerIds = [...input.court.teamB.playerIds];
  const winnerPlayerIdSet = new Set(
    (input.winnerTeam === "A" ? teamAPlayerIds : teamBPlayerIds).map((id) => id.toString()),
  );

  const now = Date.now();
  const slots = [
    { playerId: teamAPlayerIds[0], team: "A" as const },
    { playerId: teamBPlayerIds[0], team: "B" as const },
  ].filter((slot): slot is { playerId: Types.ObjectId; team: "A" | "B" } => Boolean(slot.playerId));

  await insertRequeueEntries(
    input.gameId,
    slots.map((slot, index) => {
      const isWinner = winnerPlayerIdSet.has(slot.playerId.toString());
      return {
        playerId: slot.playerId,
        queueType: isSinglesWinnerLoserRotation(input.format.matchingType)
          ? isWinner
            ? "winner"
            : "loser"
          : "normal",
        registeredAt: new Date(now + index),
        lastMatchResult: isWinner ? "win" : "loss",
      };
    }),
  );

  await markCourtEntriesDone(input.court);

  if (isSinglesWinnerLoserRotation(input.format.matchingType)) {
    const queued = await QueueEntry.find({ gameId: input.gameId, status: "queued" })
      .sort({ registeredAt: 1 })
      .populate("playerId");
    const views = queued.map((entry) => toQueueEntryViewForPick(entry as QueueEntryLike));
    const rebuilt = rebuildSinglesQueueOrder(views);
    const byId = new Map(queued.map((entry) => [String(entry._id), entry]));
    const ordered = rebuilt
      .map((view) => byId.get(view._id))
      .filter((entry): entry is (typeof queued)[number] => entry != null);
    await persistQueueOrder(ordered);
  }

  return {
    ok: true,
    rematch: false,
    requeueMode: "singles" as const,
    message: "Game ended and players returned to the queue.",
  };
}

async function reorderQueuedEntries(gameId: string) {
  const queued = await QueueEntry.find({ gameId, status: "queued" })
    .sort({ registeredAt: 1 })
    .populate("playerId");
  const views = queued.map((entry) => toQueueEntryViewForPick(entry as QueueEntryLike));
  const rebuilt = appendDoublesRequeueEntries([], views);
  const byId = new Map(queued.map((entry) => [String(entry._id), entry]));
  const ordered = rebuilt
    .map((view) => byId.get(view._id))
    .filter((entry): entry is (typeof queued)[number] => entry != null);
  if (ordered.length === queued.length) {
    await persistQueueOrder(ordered);
  }
}

async function requeueDoublesCourtStandard(input: {
  gameId: string;
  court: CourtDoc;
  winnerPlayerIdSet: Set<string>;
  format: GameFormatSettings;
}) {
  const teamAPlayers = [...input.court.teamA.playerIds];
  const teamBPlayers = [...input.court.teamB.playerIds];
  const now = Date.now();
  const crossedOrder = crossRequeuePlayerOrder(teamAPlayers, teamBPlayers);
  const lockInByPlayer = await getLockInGroupIdByPlayerIds(input.gameId, crossedOrder);
  const requeueOrder = keepLockInPartnersTogether(
    crossedOrder,
    (playerId) => lockInByPlayer.get(playerId.toString()) ?? null,
  );

  if (isMixedDoublesMatching(input.format.matchingType)) {
    const winnerPairGroupId = `W-${nanoid(8)}`;
    const loserPairGroupId = `L-${nanoid(8)}`;
    const specs = requeueOrder.map((playerId, index) => {
      const isWinner = input.winnerPlayerIdSet.has(playerId.toString());
      return {
        playerId,
        queueType: isWinner ? ("winner" as const) : ("loser" as const),
        pairGroupId: isWinner ? winnerPairGroupId : loserPairGroupId,
        registeredAt: new Date(now + index),
        lastMatchResult: isWinner ? ("win" as const) : ("loss" as const),
        lockInGroupId: lockInByPlayer.get(playerId.toString()) ?? null,
      };
    });

    const currentQueued = await QueueEntry.find({ gameId: input.gameId, status: "queued" })
      .sort({ registeredAt: 1 })
      .populate("playerId");
    const currentViews = currentQueued.map((entry) =>
      toQueueEntryViewForPick(entry as QueueEntryLike),
    );
    const optimisticRequeue: QueueEntryView[] = specs.map((spec, index) => ({
      _id: `temp-${index}`,
      queueType: spec.queueType,
      playerId: { firstName: "", lastName: "", gender: undefined },
      registeredAt: spec.registeredAt.toISOString(),
      lastMatchResult: spec.lastMatchResult,
    }));
    const orderedViews = orderMixedDoublesRequeueEntries(currentViews, optimisticRequeue);

    await markCourtEntriesDone(input.court);
    await insertRequeueEntries(input.gameId, specs);

    const queuedAfter = await QueueEntry.find({ gameId: input.gameId, status: "queued" })
      .sort({ registeredAt: 1 })
      .populate("playerId");
    const newestIds = new Set(
      (
        await QueueEntry.find({ gameId: input.gameId, status: "queued" })
          .sort({ createdAt: -1 })
          .limit(specs.length)
      ).map((entry) => String(entry._id)),
    );
    const newest = queuedAfter.filter((entry) => newestIds.has(String(entry._id)));
    const tail = queuedAfter.filter((entry) => !newestIds.has(String(entry._id)));
  const orderedEntries = orderedViews
      .map((view) =>
        newest.find(
          (entry) =>
            entry.queueType === view.queueType && entry.lastMatchResult === view.lastMatchResult,
        ),
      )
      .filter((entry): entry is (typeof newest)[number] => entry != null);
    if (orderedEntries.length === specs.length) {
      await persistQueueOrder([...tail, ...orderedEntries]);
    }
    await clusterQueuedLockInGroups(input.gameId);

    return {
      ok: true,
      rematch: false,
      requeueMode: "mixed-doubles" as const,
      message: "Game ended and players returned to the queue.",
    };
  }

  if (isDoublesWinnerLoserRotation(input.format.matchingType)) {
    const winnerPairGroupId = `W-${nanoid(8)}`;
    const loserPairGroupId = `L-${nanoid(8)}`;

    await markCourtEntriesDone(input.court);
    await insertRequeueEntries(
      input.gameId,
      requeueOrder.map((playerId, index) => {
        const isWinner = input.winnerPlayerIdSet.has(playerId.toString());
        return {
          playerId,
          queueType: isWinner ? "winner" : "loser",
          pairGroupId: isWinner ? winnerPairGroupId : loserPairGroupId,
          registeredAt: new Date(now + index),
          lastMatchResult: isWinner ? "win" : "loss",
          lockInGroupId: lockInByPlayer.get(playerId.toString()) ?? null,
        };
      }),
    );
    await reorderQueuedEntries(input.gameId);
    await clusterQueuedLockInGroups(input.gameId);

    return {
      ok: true,
      rematch: false,
      requeueMode: "winner-loser" as const,
      message: "Game ended and players returned to the queue.",
    };
  }

  await markCourtEntriesDone(input.court);
  await insertRequeueEntries(
    input.gameId,
    requeueOrder.map((playerId, index) => ({
      playerId,
      queueType: "normal" as const,
      registeredAt: new Date(now + index),
      lastMatchResult: input.winnerPlayerIdSet.has(playerId.toString())
        ? ("win" as const)
        : ("loss" as const),
      lockInGroupId: lockInByPlayer.get(playerId.toString()) ?? null,
    })),
    { clusterLockInGroups: false },
  );
  await persistFinishedPlayersAtQueueTail(input.gameId, requeueOrder);
  await clusterQueuedLockInGroups(input.gameId);

  return {
    ok: true,
    rematch: false,
    requeueMode: "standard" as const,
    message: "Game ended and players returned to the queue.",
  };
}

export async function requeuePlayersAfterCourtEnd(input: {
  gameId: string;
  court: CourtDoc;
  winnerTeam: "A" | "B";
  format: GameFormatSettings;
}) {
  const playersOnCourt =
    input.court.teamA.playerIds.length + input.court.teamB.playerIds.length;

  if (input.format.gameMode === "singles" || playersOnCourt === 2) {
    return requeueSinglesCourt({
      gameId: input.gameId,
      court: input.court,
      winnerTeam: input.winnerTeam,
      format: input.format,
    });
  }

  return requeueDoublesCourtStandard({
    gameId: input.gameId,
    court: input.court,
    winnerPlayerIdSet: new Set(
      (input.winnerTeam === "A" ? input.court.teamA.playerIds : input.court.teamB.playerIds).map(
        (id) => id.toString(),
      ),
    ),
    format: input.format,
  });
}
