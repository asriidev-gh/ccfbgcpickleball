import { nanoid } from "nanoid";
import { Types } from "mongoose";

import {
  COURT_CANCEL_GRACE_MS,
  clearCourtTimerPauseFields,
  getCourtEffectiveElapsedMs,
  toCourtTimerClock,
} from "@/lib/court-cancel-grace";
import {
  buildRotationRequeuePlayerOrder,
  countActiveRotationPlayers,
  shouldUseRotationRequeue,
} from "@/lib/rotation-requeue";
import {
  minPlayersForGameFormat,
  resolveGameFormatSettings,
} from "@/lib/game-format-settings";
import {
  assignCourtTeams,
  resolveCourtAssignmentFromQueue,
  type QueueEntryLike,
} from "@/lib/queue-court-assignment";
import { requeuePlayersAfterCourtEnd } from "@/lib/queue-end-requeue";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import "@/models/Player";

const COURT_EMPTY_WAIT_MS = 5_000;
const COURT_EMPTY_POLL_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findEmptyCourt(gameId: string, courtNumber?: number) {
  const deadline =
    courtNumber != null ? Date.now() + COURT_EMPTY_WAIT_MS : Date.now();

  while (true) {
    const court =
      courtNumber != null
        ? await Court.findOne({ gameId, courtNumber, status: "empty" })
        : await Court.findOne({ gameId, status: "empty" }).sort({ courtNumber: 1 });

    if (court) return court;

    if (courtNumber == null || Date.now() >= deadline) {
      return null;
    }

    await sleep(COURT_EMPTY_POLL_MS);
  }
}

export async function startGameOnCourt(
  gameId: string,
  courtNumber?: number,
  options?: { queueEntryIds?: string[] },
) {
  const game = await PickleGame.findOne({ gameId }).select("gameMode matchingType");
  if (!game) throw new Error("Game not found.");

  const format = resolveGameFormatSettings(game);
  const minPlayers = minPlayersForGameFormat(format.gameMode);

  const court = await findEmptyCourt(gameId, courtNumber);
  if (!court) {
    throw new Error(
      courtNumber != null
        ? `Court ${courtNumber} is not available.`
        : "No empty court available.",
    );
  }

  const entries = await QueueEntry.find({ gameId, status: "queued" })
    .sort({ registeredAt: 1 })
    .populate("playerId");

  let assignment: ReturnType<typeof resolveCourtAssignmentFromQueue>;
  const requestedEntryIds = options?.queueEntryIds?.map(String);
  if (requestedEntryIds?.length === minPlayers) {
    const byId = new Map(entries.map((entry) => [String(entry._id), entry as QueueEntryLike]));
    const picked = requestedEntryIds.map((entryId) => {
      const entry = byId.get(entryId);
      if (!entry) {
        throw new Error("One or more selected queue entries are no longer available.");
      }
      return entry;
    });
    assignment = assignCourtTeams(picked, format);
    if (!assignment) {
      throw new Error(`Not enough queued players. At least ${minPlayers} players are required.`);
    }
  } else {
    assignment = resolveCourtAssignmentFromQueue(entries as QueueEntryLike[], format);
    if (!assignment) {
      throw new Error(`Not enough queued players. At least ${minPlayers} players are required.`);
    }
  }

  const resolvePlayerObjectId = (entry: QueueEntryLike) => {
    const player = entry.playerId as Types.ObjectId | { _id: Types.ObjectId };
    return typeof player === "object" && player != null && "_id" in player
      ? player._id
      : (player as Types.ObjectId);
  };

  const resolveEntryObjectId = (entry: QueueEntryLike) =>
    entry._id instanceof Types.ObjectId ? entry._id : new Types.ObjectId(String(entry._id));

  await QueueEntry.updateMany(
    { _id: { $in: assignment.picked.map(resolveEntryObjectId) } },
    { $set: { status: "on_court" } },
  );

  court.status = "active";
  court.startedAt = new Date();
  court.pausedAt = null;
  court.totalPausedMs = 0;
  court.isRematch = false;
  court.teamA = {
    playerIds: assignment.teamA.map(resolvePlayerObjectId),
    queueEntryIds: assignment.teamA.map(resolveEntryObjectId),
  };
  court.teamB = {
    playerIds: assignment.teamB.map(resolvePlayerObjectId),
    queueEntryIds: assignment.teamB.map(resolveEntryObjectId),
  };
  await court.save();

  return court;
}

export async function startGameOnFirstAvailableCourt(gameId: string) {
  return startGameOnCourt(gameId);
}

type CourtSlot = { playerId: Types.ObjectId; queueEntryId: Types.ObjectId };

function shuffleSlots<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function teamKey(slots: CourtSlot[]): string {
  return slots
    .map((slot) => slot.playerId.toString())
    .sort()
    .join(",");
}

function shuffleIntoNewHalves<T>(
  items: T[],
  teamKeyForHalf: (half: T[]) => string,
): { firstHalf: T[]; secondHalf: T[] } {
  if (items.length < 2) {
    throw new Error("Not enough players to shuffle.");
  }

  const half = Math.floor(items.length / 2);
  const currentKey = teamKeyForHalf(items.slice(0, half));

  let shuffled = items;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    shuffled = shuffleSlots(items);
    if (teamKeyForHalf(shuffled.slice(0, half)) !== currentKey) break;
  }

  return { firstHalf: shuffled.slice(0, half), secondHalf: shuffled.slice(half) };
}

/** Apply a new FIFO order for all queued players (top 4 + waiting line). */
export async function reorderQueuedPlayers(gameId: string, orderedEntryIds: string[]) {
  const queue = await QueueEntry.find({ gameId, status: "queued" }).sort({ registeredAt: 1 });

  if (orderedEntryIds.length !== queue.length) {
    throw new Error("Queue order must include every queued player exactly once.");
  }

  const byId = new Map(queue.map((entry) => [entry._id.toString(), entry]));
  const seen = new Set<string>();
  const reordered = orderedEntryIds.map((entryId) => {
    const normalizedId = String(entryId);
    if (seen.has(normalizedId)) {
      throw new Error("Queue order must include every queued player exactly once.");
    }
    seen.add(normalizedId);
    const entry = byId.get(normalizedId);
    if (!entry) {
      throw new Error("Invalid queue entry in reorder request.");
    }
    return entry;
  });

  await persistQueueOrder(reordered);
}

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

/** Re-pair the next four queued players (Team A = #1–2, Team B = #3–4). */
export async function shuffleNextOnCourtInQueue(gameId: string) {
  const queue = await QueueEntry.find({ gameId, status: "queued" }).sort({ registeredAt: 1 });
  if (queue.length < 4) {
    throw new Error("Not enough queued players. At least 4 players are required.");
  }

  const nextUp = queue.slice(0, 4);
  const { firstHalf, secondHalf } = shuffleIntoNewHalves(nextUp, (half) =>
    teamKey(
      half.map((entry) => ({
        playerId: entry.playerId as Types.ObjectId,
        queueEntryId: entry._id,
      })),
    ),
  );

  await persistQueueOrder([...firstHalf, ...secondHalf, ...queue.slice(4)]);
}

/** Move a ready deck foursome onto the promoted open-court line (Team A vs Team B). */
export async function promoteDeckMatchToOpenCourt(input: {
  gameId: string;
  teamAEntryIds: string[];
  teamBEntryIds: string[];
}) {
  const allIds = [...input.teamAEntryIds, ...input.teamBEntryIds];
  if (new Set(allIds).size !== 4) {
    throw new Error("All four queue entry ids must be unique.");
  }

  const entries = await QueueEntry.find({
    gameId: input.gameId,
    status: "queued",
    _id: { $in: allIds },
  });

  if (entries.length !== 4) {
    throw new Error("One or more players are not in the queue.");
  }

  const byId = new Map(entries.map((entry) => [String(entry._id), entry]));
  for (const id of allIds) {
    if (!byId.has(id)) {
      throw new Error("One or more queue entries were not found.");
    }
  }

  const openCourtGroupId = `OC-${nanoid(8)}`;

  await Promise.all(
    input.teamAEntryIds.map((id) =>
      QueueEntry.updateOne(
        { _id: id },
        {
          $set: {
            deckPlacement: "open_court",
            openCourtGroupId,
            openCourtTeam: "A",
          },
        },
      ),
    ),
  );
  await Promise.all(
    input.teamBEntryIds.map((id) =>
      QueueEntry.updateOne(
        { _id: id },
        {
          $set: {
            deckPlacement: "open_court",
            openCourtGroupId,
            openCourtTeam: "B",
          },
        },
      ),
    ),
  );

  const queue = await QueueEntry.find({ gameId: input.gameId, status: "queued" }).sort({
    registeredAt: 1,
  });
  const promoteSet = new Set(allIds);
  const others = queue.filter((entry) => !promoteSet.has(String(entry._id)));
  const promotedOrdered = [
    ...input.teamAEntryIds.map((id) => byId.get(id)!),
    ...input.teamBEntryIds.map((id) => byId.get(id)!),
  ];

  await persistQueueOrder([...others, ...promotedOrdered]);
}

/**
 * Randomly re-pairs everyone on a court into two new teams. Each call produces
 * a different team composition than the current one (when possible), so the
 * operator can keep re-rolling until the matchup looks right.
 */
export async function swapPlayersBetweenCourtTeams(input: {
  gameId: string;
  courtNumber: number;
  slotIndex?: number;
}) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");

  const slots: CourtSlot[] = [
    ...court.teamA.playerIds.map((playerId: Types.ObjectId, index: number) => ({
      playerId,
      queueEntryId: court.teamA.queueEntryIds[index],
    })),
    ...court.teamB.playerIds.map((playerId: Types.ObjectId, index: number) => ({
      playerId,
      queueEntryId: court.teamB.queueEntryIds[index],
    })),
  ];

  const { firstHalf: nextA, secondHalf: nextB } = shuffleIntoNewHalves(slots, teamKey);

  court.teamA = {
    playerIds: nextA.map((slot) => slot.playerId),
    queueEntryIds: nextA.map((slot) => slot.queueEntryId),
  };
  court.teamB = {
    playerIds: nextB.map((slot) => slot.playerId),
    queueEntryIds: nextB.map((slot) => slot.queueEntryId),
  };
  court.markModified("teamA");
  court.markModified("teamB");
  await court.save();

  return court;
}

function finalizeCourtPauseDuration(court: {
  pausedAt?: Date | null;
  totalPausedMs?: number | null;
}, endedAt = new Date()) {
  if (!court.pausedAt) return;

  const pauseStart = new Date(court.pausedAt).getTime();
  if (Number.isNaN(pauseStart)) {
    court.pausedAt = null;
    return;
  }

  court.totalPausedMs = (court.totalPausedMs ?? 0) + (endedAt.getTime() - pauseStart);
  court.pausedAt = null;
}

/** Pause or unpause the active court play clock. */
export async function setCourtPaused(input: {
  gameId: string;
  courtNumber: number;
  paused: boolean;
}) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");
  if (!court.startedAt) throw new Error("Court start time is missing.");

  const now = new Date();

  if (input.paused) {
    if (!court.pausedAt) {
      court.pausedAt = now;
      await court.save();
    }
    return court;
  }

  if (court.pausedAt) {
    finalizeCourtPauseDuration(court, now);
    await court.save();
  }

  return court;
}

/** Pause or unpause every active court play clock. */
export async function setAllActiveCourtsPaused(input: {
  gameId: string;
  paused: boolean;
}) {
  const courts = await Court.find({
    gameId: input.gameId,
    status: "active",
  });

  if (courts.length === 0) {
    throw new Error("No active courts to update.");
  }

  const now = new Date();
  let updatedCount = 0;

  for (const court of courts) {
    if (!court.startedAt) continue;

    if (input.paused) {
      if (!court.pausedAt) {
        court.pausedAt = now;
        await court.save();
        updatedCount += 1;
      }
      continue;
    }

    if (court.pausedAt) {
      finalizeCourtPauseDuration(court, now);
      await court.save();
      updatedCount += 1;
    }
  }

  if (updatedCount === 0) {
    throw new Error(
      input.paused ? "All active courts are already paused." : "No paused courts to resume.",
    );
  }

  return { updatedCount, totalActive: courts.length };
}

/** Undo an active court fill — return those four players to the top of the queue. */
export async function cancelCourtAssignment(input: { gameId: string; courtNumber: number }) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");

  if (!court.startedAt) {
    throw new Error("Court start time is missing.");
  }

  const elapsedMs = getCourtEffectiveElapsedMs(toCourtTimerClock(court));
  if (elapsedMs > COURT_CANCEL_GRACE_MS) {
    throw new Error("The cancel window has expired. Players are already in play.");
  }

  const courtQueueEntryIds = [...court.teamA.queueEntryIds, ...court.teamB.queueEntryIds];
  if (courtQueueEntryIds.length !== 4) {
    throw new Error("Court does not have a full assignment to cancel.");
  }

  const courtEntries = await QueueEntry.find({
    _id: { $in: courtQueueEntryIds },
    gameId: input.gameId,
    status: "on_court",
  });
  if (courtEntries.length !== 4) {
    throw new Error("One or more court players are no longer on court.");
  }

  const otherQueued = await QueueEntry.find({ gameId: input.gameId, status: "queued" }).sort({
    registeredAt: 1,
  });

  const courtEntriesOrdered = [...courtEntries].sort(
    (a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime(),
  );

  court.status = "empty";
  court.teamA = { playerIds: [], queueEntryIds: [] };
  court.teamB = { playerIds: [], queueEntryIds: [] };
  court.startedAt = null;
  Object.assign(court, clearCourtTimerPauseFields());
  court.isRematch = false;
  await court.save();

  await QueueEntry.updateMany(
    { _id: { $in: courtQueueEntryIds } },
    { $set: { status: "queued" } },
  );

  await persistQueueOrder([...courtEntriesOrdered, ...otherQueued]);

  return court;
}

/** End a rematch early — return the four players to the queue (no history or stats changes). */
export async function cancelRematch(input: { gameId: string; courtNumber: number }) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");
  if (!court.isRematch) {
    throw new Error("This court is not in a rematch.");
  }

  if (!court.startedAt) {
    throw new Error("Court start time is missing.");
  }

  const elapsedMs = getCourtEffectiveElapsedMs(toCourtTimerClock(court));
  if (elapsedMs > COURT_CANCEL_GRACE_MS) {
    throw new Error("The cancel window has expired. Players are already in play.");
  }

  const courtQueueEntryIds = [...court.teamA.queueEntryIds, ...court.teamB.queueEntryIds];
  if (courtQueueEntryIds.length !== 4) {
    throw new Error("Court does not have a full assignment to cancel.");
  }

  const courtEntries = await QueueEntry.find({
    _id: { $in: courtQueueEntryIds },
    gameId: input.gameId,
    status: "on_court",
  });
  if (courtEntries.length !== 4) {
    throw new Error("One or more court players are no longer on court.");
  }

  const otherQueued = await QueueEntry.find({ gameId: input.gameId, status: "queued" }).sort({
    registeredAt: 1,
  });

  const courtEntriesOrdered = [...courtEntries].sort(
    (a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime(),
  );

  court.status = "empty";
  court.teamA = { playerIds: [], queueEntryIds: [] };
  court.teamB = { playerIds: [], queueEntryIds: [] };
  court.startedAt = null;
  Object.assign(court, clearCourtTimerPauseFields());
  court.isRematch = false;
  await court.save();

  await QueueEntry.updateMany(
    { _id: { $in: courtQueueEntryIds } },
    { $set: { status: "queued" } },
  );

  await persistQueueOrder([...otherQueued, ...courtEntriesOrdered]);

  return court;
}

/** Swap an active-court player with someone from the queue (next up or waiting line). */
export async function replaceCourtPlayerWithWaiting(input: {
  gameId: string;
  courtNumber: number;
  team: "A" | "B";
  slotIndex: number;
  targetIndex: number;
}) {
  if (input.slotIndex < 0 || input.slotIndex > 1) {
    throw new Error("slotIndex must be 0 or 1.");
  }

  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");

  const teamKey = input.team === "A" ? "teamA" : "teamB";
  const team = court[teamKey];
  if (input.slotIndex >= team.playerIds.length) {
    throw new Error("Invalid player slot on court.");
  }

  const courtQueueEntryId = team.queueEntryIds[input.slotIndex];
  const courtEntry = await QueueEntry.findById(courtQueueEntryId);
  if (!courtEntry || courtEntry.status !== "on_court") {
    throw new Error("Court player queue entry not found.");
  }

  const queue = await QueueEntry.find({ gameId: input.gameId, status: "queued" }).sort({
    registeredAt: 1,
  });

  if (input.targetIndex < 0 || input.targetIndex >= queue.length) {
    throw new Error("Selected player is not in the queue.");
  }

  const queuedEntry = queue[input.targetIndex];

  team.playerIds[input.slotIndex] = queuedEntry.playerId as Types.ObjectId;
  team.queueEntryIds[input.slotIndex] = queuedEntry._id;
  court.markModified(teamKey);

  const reordered = [
    ...queue.slice(0, input.targetIndex),
    courtEntry,
    ...queue.slice(input.targetIndex + 1),
  ];
  await persistQueueOrder(reordered);

  await QueueEntry.updateOne({ _id: queuedEntry._id }, { $set: { status: "on_court" } });
  await QueueEntry.updateOne({ _id: courtEntry._id }, { $set: { status: "queued" } });

  await court.save();

  return court;
}

async function recalculateLeaderboardWinRates(gameId: string) {
  const allStats = await LeaderboardStats.find({ gameId });
  await Promise.all(
    allStats.map(async (stat) => {
      stat.winRate = stat.gamesPlayed > 0 ? Math.round((stat.wins / stat.gamesPlayed) * 100) : 0;
      await stat.save();
    }),
  );
}

export async function endGameAndRequeue(input: {
  gameId: string;
  courtNumber: number;
  winnerTeam: "A" | "B";
  teamAScore: number;
  teamBScore: number;
  rematch?: boolean;
}) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");

  const winnerPlayers = input.winnerTeam === "A" ? court.teamA.playerIds : court.teamB.playerIds;
  const loserPlayers = input.winnerTeam === "A" ? court.teamB.playerIds : court.teamA.playerIds;
  const winnerPlayerIdSet = new Set(winnerPlayers.map((id: Types.ObjectId) => id.toString()));

  const endedAt = new Date();
  finalizeCourtPauseDuration(court, endedAt);
  const startedAt = court.startedAt ? new Date(court.startedAt) : endedAt;
  const durationSeconds = court.startedAt
    ? Math.max(
        0,
        Math.floor(
          getCourtEffectiveElapsedMs(
            {
              startedAt: court.startedAt,
              pausedAt: null,
              totalPausedMs: court.totalPausedMs ?? 0,
            },
            endedAt.getTime(),
          ) / 1000,
        ),
      )
    : 0;

  await MatchHistory.create({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    teamAPlayerIds: court.teamA.playerIds,
    teamBPlayerIds: court.teamB.playerIds,
    winnerTeam: input.winnerTeam,
    loserTeam: input.winnerTeam === "A" ? "B" : "A",
    teamAScore: input.teamAScore,
    teamBScore: input.teamBScore,
    startedAt,
    endedAt,
    durationSeconds,
  });

  await Promise.all(
    [...winnerPlayers, ...loserPlayers].map(async (playerId: Types.ObjectId) => {
      const hasWon = winnerPlayerIdSet.has(playerId.toString());
      await LeaderboardStats.findOneAndUpdate(
        { gameId: input.gameId, playerId },
        {
          $inc: {
            gamesPlayed: 1,
            wins: hasWon ? 1 : 0,
            losses: hasWon ? 0 : 1,
            currentStreak: hasWon ? 1 : -1,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }),
  );

  await recalculateLeaderboardWinRates(input.gameId);

  if (input.rematch) {
    court.startedAt = new Date();
    Object.assign(court, clearCourtTimerPauseFields());
    court.isRematch = true;
    court.markModified("isRematch");
    await court.save();
    return {
      ok: true,
      rematch: true,
      message: `Court ${input.courtNumber} rematch started — same players, fresh clock.`,
    };
  }

  const game = await PickleGame.findOne({ gameId: input.gameId }).select("gameMode matchingType");
  const format = resolveGameFormatSettings(game ?? undefined);

  const requeueResult = await requeuePlayersAfterCourtEnd({
    gameId: input.gameId,
    court,
    winnerTeam: input.winnerTeam,
    format,
  });

  court.status = "empty";
  court.teamA = { playerIds: [], queueEntryIds: [] };
  court.teamB = { playerIds: [], queueEntryIds: [] };
  court.startedAt = null;
  Object.assign(court, clearCourtTimerPauseFields());
  court.isRematch = false;
  await court.save();

  return requeueResult;
}

async function requeueCourtPlayersWithRotation(input: {
  gameId: string;
  court: {
    teamA: { playerIds: Types.ObjectId[]; queueEntryIds: Types.ObjectId[] };
    teamB: { playerIds: Types.ObjectId[]; queueEntryIds: Types.ObjectId[] };
  };
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

  if (!playerOrder) return false;

  const pairAIds = new Set(
    input.court.teamA.playerIds.map((id: Types.ObjectId) => id.toString()),
  );
  const pairBIds = new Set(
    input.court.teamB.playerIds.map((id: Types.ObjectId) => id.toString()),
  );
  const courtPlayerIds = new Set([...pairAIds, ...pairBIds]);

  await QueueEntry.updateMany(
    {
      _id: { $in: [...input.court.teamA.queueEntryIds, ...input.court.teamB.queueEntryIds] },
    },
    { $set: { status: "done" } },
  );

  const now = Date.now();
  const newEntriesByPlayerId = new Map<string, (typeof queued)[number]>();

  for (const playerId of [...input.court.teamA.playerIds, ...input.court.teamB.playerIds]) {
    const playerKey = playerId.toString();
    const isWinner = input.winnerPlayerIdSet.has(playerKey);
    const entry = await QueueEntry.create({
      gameId: input.gameId,
      playerId,
      status: "queued",
      queueType: "normal",
      pairGroupId: null,
      deckPlacement: null,
      openCourtGroupId: null,
      openCourtTeam: null,
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

    const existing = queued.find((entry) => entry.playerId.toString() === playerKey);
    if (!existing) {
      throw new Error("Rotation requeue could not resolve a queued player.");
    }
    return existing;
  });

  await persistQueueOrder(orderedEntries);
  return true;
}
