import { nanoid } from "nanoid";
import { Types } from "mongoose";

import { appendDoublesRequeueEntries } from "@/lib/doubles/doubles-queue-fill";
import { isDoublesWinnerLoserRotation } from "@/lib/doubles/doubles-queue-fill";
import { orderMixedDoublesRequeueEntries } from "@/lib/doubles/mixed-doubles-requeue";
import type { GameFormatSettings } from "@/lib/game-format-settings";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { toQueueEntryViewForPick, type QueueEntryLike } from "@/lib/queue-court-assignment";
import { isMixedDoublesMatching } from "@/lib/quick-play-wizard-shared";
import {
  buildRotationRequeuePlayerOrder,
  countActiveRotationPlayers,
  shouldUseRotationRequeue,
} from "@/lib/rotation-requeue";
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

  await Promise.all(
    orderedEntries.map((entry, index) =>
      QueueEntry.updateOne(
        { _id: entry._id },
        { $set: { registeredAt: new Date(baseTime + index * 1000) } },
      ),
    ),
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
    registeredAt: Date;
    lastMatchResult: "win" | "loss";
  }>,
) {
  if (specs.length === 0) return;
  await clearStaleQueuedEntriesForPlayers(
    gameId,
    specs.map((spec) => spec.playerId),
  );
  await QueueEntry.insertMany(
    specs.map((spec) => ({
      gameId,
      playerId: spec.playerId,
      status: "queued",
      queueType: spec.queueType,
      pairGroupId: spec.pairGroupId ?? null,
      registeredAt: spec.registeredAt,
      lastMatchResult: spec.lastMatchResult,
      winStreak: spec.lastMatchResult === "win" ? 1 : 0,
    })),
  );
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

async function requeueDoublesCourtWithRotation(input: {
  gameId: string;
  court: CourtDoc;
  winnerPlayerIdSet: Set<string>;
}) {
  const queued = await QueueEntry.find({ gameId: input.gameId, status: "queued" }).sort({
    registeredAt: 1,
  });

  const playerOrder = buildRotationRequeuePlayerOrder({
    queuedPlayerIds: queued.map((entry) => entry.playerId as Types.ObjectId),
    court: {
      teamAPlayerIds: [...input.court.teamA.playerIds],
      teamBPlayerIds: [...input.court.teamB.playerIds],
    },
  });

  if (!playerOrder || input.court.teamA.playerIds.length !== 2) return null;

  const courtPlayerIds = new Set(
    [...input.court.teamA.playerIds, ...input.court.teamB.playerIds].map((id) => id.toString()),
  );

  await markCourtEntriesDone(input.court);

  const courtPlayerObjectIds = [
    ...input.court.teamA.playerIds,
    ...input.court.teamB.playerIds,
  ];
  await clearStaleQueuedEntriesForPlayers(input.gameId, courtPlayerObjectIds);

  const now = Date.now();
  const newEntriesByPlayerId = new Map<string, (typeof queued)[number]>();

  for (const playerId of courtPlayerObjectIds) {
    const playerKey = playerId.toString();
    const isWinner = input.winnerPlayerIdSet.has(playerKey);
    const entry = await QueueEntry.create({
      gameId: input.gameId,
      playerId,
      status: "queued",
      queueType: "normal",
      pairGroupId: null,
      registeredAt: new Date(now),
      lastMatchResult: isWinner ? "win" : "loss",
      winStreak: isWinner ? 1 : 0,
    });
    newEntriesByPlayerId.set(playerKey, entry);
  }

  const orderedEntries = playerOrder.map((playerId) => {
    const playerKey = playerId.toString();
    if (courtPlayerIds.has(playerKey)) {
      return newEntriesByPlayerId.get(playerKey)!;
    }
    return queued.find((entry) => entry.playerId.toString() === playerKey)!;
  });

  await persistQueueOrder(orderedEntries);

  return {
    ok: true,
    rematch: false,
    requeueMode: "rotation" as const,
    message: "Game ended — players rotated in the queue.",
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
  const requeueOrder = crossRequeuePlayerOrder(teamAPlayers, teamBPlayers);

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
        };
      }),
    );
    await reorderQueuedEntries(input.gameId);

    return {
      ok: true,
      rematch: false,
      requeueMode: "winner-loser" as const,
      message: "Game ended and players returned to the queue.",
    };
  }

  const activePlayerCount = await countActiveRotationPlayers(input.gameId);
  if (shouldUseRotationRequeue(activePlayerCount)) {
    const rotated = await requeueDoublesCourtWithRotation({
      gameId: input.gameId,
      court: input.court,
      winnerPlayerIdSet: input.winnerPlayerIdSet,
    });
    if (rotated) return rotated;
  }

  await markCourtEntriesDone(input.court);
  await insertRequeueEntries(
    input.gameId,
    requeueOrder.map((playerId, index) => ({
      playerId,
      queueType: "normal",
      registeredAt: new Date(now + index),
      lastMatchResult: input.winnerPlayerIdSet.has(playerId.toString()) ? "win" : "loss",
    })),
  );

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
