import { nanoid } from "nanoid";
import { Types } from "mongoose";

import {
  COURT_CANCEL_GRACE_MS,
  clearCourtTimerPauseFields,
  getCourtEffectiveElapsedMs,
  toCourtTimerClock,
} from "@/lib/court-cancel-grace";
import {
  minPlayersForGameFormat,
  resolveGameFormatSettings,
} from "@/lib/game-format-settings";
import {
  resolveCourtAssignmentFromQueue,
  type QueueEntryLike,
} from "@/lib/queue-court-assignment";
import { getLockInGroupIdByPlayerIds } from "@/lib/lock-in-groups";
import {
  hasLockInPair,
  keepLockInPartnersTogether,
  LOCKED_IN_LINEUP_LOCKED_MESSAGE,
  lockInPairsOccupyPartnerSlots,
  playerIdsIncludeLockInPair,
} from "@/lib/lock-in-groups-shared";
import { requeuePlayersAfterCourtEnd } from "@/lib/queue-end-requeue";
import { healOrphanedOnCourtEntries } from "@/lib/queue-on-court-orphans";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import "@/models/Player";

const COURT_EMPTY_WAIT_MS = 5_000;
const COURT_EMPTY_POLL_MS = 250;

function emptyCourtTeam() {
  return { playerIds: [] as Types.ObjectId[], queueEntryIds: [] as Types.ObjectId[] };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePlayerObjectId(entry: QueueEntryLike) {
  const player = entry.playerId as Types.ObjectId | { _id: Types.ObjectId };
  return typeof player === "object" && player != null && "_id" in player
    ? player._id
    : (player as Types.ObjectId);
}

function resolveEntryObjectId(entry: QueueEntryLike) {
  return entry._id instanceof Types.ObjectId ? entry._id : new Types.ObjectId(String(entry._id));
}

/** Atomically claim an empty court and assign teams in one write to prevent fill races. */
async function claimEmptyCourtWithTeams(
  gameId: string,
  courtNumber: number | undefined,
  teams: {
    teamA: { playerIds: Types.ObjectId[]; queueEntryIds: Types.ObjectId[] };
    teamB: { playerIds: Types.ObjectId[]; queueEntryIds: Types.ObjectId[] };
  },
) {
  const deadline = courtNumber != null ? Date.now() + COURT_EMPTY_WAIT_MS : Date.now();

  while (true) {
    const court = await Court.findOneAndUpdate(
      courtNumber != null
        ? { gameId, courtNumber, status: "empty" }
        : { gameId, status: "empty" },
      {
        $set: {
          status: "active",
          startedAt: new Date(),
          pausedAt: null,
          totalPausedMs: 0,
          isRematch: false,
          teamA: teams.teamA,
          teamB: teams.teamB,
        },
      },
      {
        sort: courtNumber == null ? { courtNumber: 1 } : undefined,
        returnDocument: "after",
      },
    );

    if (court) return court;

    if (courtNumber == null || Date.now() >= deadline) {
      return null;
    }

    await sleep(COURT_EMPTY_POLL_MS);
  }
}

async function releaseClaimedCourt(courtId: Types.ObjectId) {
  await Court.updateOne(
    { _id: courtId, status: "active" },
    {
      $set: {
        status: "empty",
        teamA: emptyCourtTeam(),
        teamB: emptyCourtTeam(),
        startedAt: null,
        ...clearCourtTimerPauseFields(),
        isRematch: false,
      },
    },
  );
}

export async function startGameOnCourt(
  gameId: string,
  courtNumber?: number,
  options?: { queueEntryIds?: string[] },
) {
  const game = await PickleGame.findOne({ gameId }).select("gameMode matchingType");
  if (!game) throw new Error("Game not found.");

  // Repair any leftover orphans before picking so they can be filled again.
  await healOrphanedOnCourtEntries(gameId);

  const format = resolveGameFormatSettings(game);
  const minPlayers = minPlayersForGameFormat(format.gameMode);

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
    // Honor the operator's confirmed team split from the fill dialog (UI shuffle).
    if (format.gameMode === "singles") {
      assignment = {
        picked,
        teamA: [picked[0]!],
        teamB: [picked[1]!],
      };
    } else {
      assignment = {
        picked,
        teamA: picked.slice(0, 2),
        teamB: picked.slice(2, 4),
      };
      if (assignment.teamA.length !== 2 || assignment.teamB.length !== 2) {
        throw new Error(`Not enough queued players. At least ${minPlayers} players are required.`);
      }
    }
  } else {
    assignment = resolveCourtAssignmentFromQueue(entries as QueueEntryLike[], format);
    if (!assignment) {
      throw new Error(`Not enough queued players. At least ${minPlayers} players are required.`);
    }
  }

  const pickedEntryIds = assignment.picked.map(resolveEntryObjectId);
  const teams = {
    teamA: {
      playerIds: assignment.teamA.map(resolvePlayerObjectId),
      queueEntryIds: assignment.teamA.map(resolveEntryObjectId),
    },
    teamB: {
      playerIds: assignment.teamB.map(resolvePlayerObjectId),
      queueEntryIds: assignment.teamB.map(resolveEntryObjectId),
    },
  };

  // Claim the court with teams first so concurrent fills cannot share one court,
  // and so a failed queue flip never leaves on_court rows without a court.
  const court = await claimEmptyCourtWithTeams(gameId, courtNumber, teams);
  if (!court) {
    throw new Error(
      courtNumber != null
        ? `Court ${courtNumber} is not available.`
        : "No empty court available.",
    );
  }

  try {
    const promoted = await QueueEntry.updateMany(
      {
        _id: { $in: pickedEntryIds },
        gameId,
        status: "queued",
      },
      { $set: { status: "on_court" } },
    );

    if ((promoted.modifiedCount ?? 0) !== pickedEntryIds.length) {
      throw new Error("One or more selected queue entries are no longer available.");
    }
  } catch (error) {
    await QueueEntry.updateMany(
      {
        _id: { $in: pickedEntryIds },
        gameId,
        status: "on_court",
      },
      { $set: { status: "queued" } },
    );
    await releaseClaimedCourt(court._id as Types.ObjectId);
    throw error;
  }

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
  if (orderedEntries.length === 0) return;

  const baseTime = new Date(orderedEntries[0].registeredAt).getTime();
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

async function persistNextFourOrder(
  orderedNextFour: Array<{ _id: Types.ObjectId; registeredAt: Date }>,
) {
  const timestamps = orderedNextFour
    .map((entry) => new Date(entry.registeredAt).getTime())
    .sort((a, b) => a - b);

  await QueueEntry.bulkWrite(
    orderedNextFour.map((entry, index) => ({
      updateOne: {
        filter: { _id: entry._id },
        update: { $set: { registeredAt: new Date(timestamps[index]!) } },
      },
    })),
    { ordered: false },
  );
}

/** Re-pair the next four queued players (Team A = #1–2, Team B = #3–4). */
export async function shuffleNextOnCourtInQueue(gameId: string) {
  const queue = await QueueEntry.find({ gameId, status: "queued" }).sort({ registeredAt: 1 });
  if (queue.length < 4) {
    throw new Error("Not enough queued players. At least 4 players are required.");
  }

  const nextUp = queue.slice(0, 4);
  if (hasLockInPair(nextUp)) {
    throw new Error(LOCKED_IN_LINEUP_LOCKED_MESSAGE);
  }
  const { firstHalf, secondHalf } = shuffleIntoNewHalves(nextUp, (half) =>
    teamKey(
      half.map((entry) => ({
        playerId: entry.playerId as Types.ObjectId,
        queueEntryId: entry._id,
      })),
    ),
  );
  const shuffled = [...firstHalf, ...secondHalf];
  const nextFour = lockInPairsOccupyPartnerSlots(shuffled, (entry) => entry.lockInGroupId)
    ? shuffled
    : keepLockInPartnersTogether(shuffled, (entry) => entry.lockInGroupId);

  await persistQueueOrder([...nextFour, ...queue.slice(4)]);
}

/**
 * Fast partner re-roll for the next four only — updates those four timestamps
 * without rewriting the rest of the waiting line.
 */
export async function quickShuffleNextOnCourtInQueue(
  gameId: string,
  nextFourEntryIds?: string[],
) {
  const queue = await QueueEntry.find({ gameId, status: "queued" }).sort({ registeredAt: 1 });
  if (queue.length < 4) {
    throw new Error("Not enough queued players. At least 4 players are required.");
  }

  if (nextFourEntryIds?.length === 4) {
    const byId = new Map(queue.map((entry) => [String(entry._id), entry]));
    const chosen = nextFourEntryIds.map((entryId) => {
      const entry = byId.get(String(entryId));
      if (!entry) {
        throw new Error("One or more selected queue entries are no longer available.");
      }
      return entry;
    });
    if (hasLockInPair(chosen)) {
      throw new Error(LOCKED_IN_LINEUP_LOCKED_MESSAGE);
    }
    const topFour = queue.slice(0, 4);
    const topIds = new Set(topFour.map((entry) => String(entry._id)));
    const sameOnDeckFoursome = chosen.every((entry) => topIds.has(String(entry._id)));
    if (sameOnDeckFoursome) {
      await persistNextFourOrder(chosen);
      return;
    }
    const chosenIds = new Set(chosen.map((entry) => String(entry._id)));
    const rest = queue.filter((entry) => !chosenIds.has(String(entry._id)));
    await persistQueueOrder([...chosen, ...rest]);
    return;
  }

  const nextUp = queue.slice(0, 4);
  if (hasLockInPair(nextUp)) {
    throw new Error(LOCKED_IN_LINEUP_LOCKED_MESSAGE);
  }
  const { firstHalf, secondHalf } = shuffleIntoNewHalves(nextUp, (half) =>
    teamKey(
      half.map((entry) => ({
        playerId: entry.playerId as Types.ObjectId,
        queueEntryId: entry._id,
      })),
    ),
  );
  const shuffled = [...firstHalf, ...secondHalf];
  const nextFour = lockInPairsOccupyPartnerSlots(shuffled, (entry) => entry.lockInGroupId)
    ? shuffled
    : keepLockInPartnersTogether(shuffled, (entry) => entry.lockInGroupId);
  await persistNextFourOrder(nextFour);
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
 * Re-pairs everyone on a court into two new teams. When the client sends an
 * explicit lineup (optimistic shuffle), apply that; otherwise shuffle server-side.
 */
export async function swapPlayersBetweenCourtTeams(input: {
  gameId: string;
  courtNumber: number;
  slotIndex?: number;
  teamAPlayerIds?: string[];
  teamBPlayerIds?: string[];
}) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");

  const courtPlayerIds = [...court.teamA.playerIds, ...court.teamB.playerIds];
  const lockInByPlayer = await getLockInGroupIdByPlayerIds(input.gameId, courtPlayerIds);
  if (playerIdsIncludeLockInPair(courtPlayerIds.map(String), lockInByPlayer)) {
    throw new Error(LOCKED_IN_LINEUP_LOCKED_MESSAGE);
  }

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

  let nextA: CourtSlot[];
  let nextB: CourtSlot[];

  if (input.teamAPlayerIds?.length === 2 && input.teamBPlayerIds?.length === 2) {
    const byPlayerId = new Map(slots.map((slot) => [String(slot.playerId), slot]));
    const requestedIds = [...input.teamAPlayerIds, ...input.teamBPlayerIds];
    if (new Set(requestedIds).size !== 4 || requestedIds.some((id) => !byPlayerId.has(id))) {
      throw new Error("Shuffle lineup must include the same four players already on the court.");
    }
    nextA = input.teamAPlayerIds.map((id) => byPlayerId.get(id)!);
    nextB = input.teamBPlayerIds.map((id) => byPlayerId.get(id)!);
  } else {
    ({ firstHalf: nextA, secondHalf: nextB } = shuffleIntoNewHalves(slots, teamKey));
  }

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

  // Restore queue status before emptying the court so a crash cannot orphan on_court rows.
  const restored = await QueueEntry.updateMany(
    {
      _id: { $in: courtQueueEntryIds },
      gameId: input.gameId,
      status: "on_court",
    },
    { $set: { status: "queued" } },
  );
  if ((restored.modifiedCount ?? 0) !== courtQueueEntryIds.length) {
    throw new Error("One or more court players are no longer on court.");
  }

  let emptied;
  try {
    emptied = await Court.findOneAndUpdate(
      { _id: court._id, status: "active" },
      {
        $set: {
          status: "empty",
          teamA: emptyCourtTeam(),
          teamB: emptyCourtTeam(),
          startedAt: null,
          ...clearCourtTimerPauseFields(),
          isRematch: false,
        },
      },
      { returnDocument: "after" },
    );
  } catch (error) {
    await QueueEntry.updateMany(
      { _id: { $in: courtQueueEntryIds }, gameId: input.gameId, status: "queued" },
      { $set: { status: "on_court" } },
    );
    throw error;
  }
  if (!emptied) {
    await QueueEntry.updateMany(
      { _id: { $in: courtQueueEntryIds }, gameId: input.gameId, status: "queued" },
      { $set: { status: "on_court" } },
    );
    throw new Error("Active court not found.");
  }

  await persistQueueOrder([...courtEntriesOrdered, ...otherQueued]);

  return emptied;
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

  const restored = await QueueEntry.updateMany(
    {
      _id: { $in: courtQueueEntryIds },
      gameId: input.gameId,
      status: "on_court",
    },
    { $set: { status: "queued" } },
  );
  if ((restored.modifiedCount ?? 0) !== courtQueueEntryIds.length) {
    throw new Error("One or more court players are no longer on court.");
  }

  let emptied;
  try {
    emptied = await Court.findOneAndUpdate(
      { _id: court._id, status: "active" },
      {
        $set: {
          status: "empty",
          teamA: emptyCourtTeam(),
          teamB: emptyCourtTeam(),
          startedAt: null,
          ...clearCourtTimerPauseFields(),
          isRematch: false,
        },
      },
      { returnDocument: "after" },
    );
  } catch (error) {
    await QueueEntry.updateMany(
      { _id: { $in: courtQueueEntryIds }, gameId: input.gameId, status: "queued" },
      { $set: { status: "on_court" } },
    );
    throw error;
  }
  if (!emptied) {
    await QueueEntry.updateMany(
      { _id: { $in: courtQueueEntryIds }, gameId: input.gameId, status: "queued" },
      { $set: { status: "on_court" } },
    );
    throw new Error("Active court not found.");
  }

  await persistQueueOrder([...otherQueued, ...courtEntriesOrdered]);

  return emptied;
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
  if (queuedEntry.lockInGroupId) {
    throw new Error("Locked-in players cannot be used as replacements.");
  }
  if (courtEntry.lockInGroupId) {
    throw new Error(LOCKED_IN_LINEUP_LOCKED_MESSAGE);
  }
  const courtPlayerIds = [...court.teamA.playerIds, ...court.teamB.playerIds];
  const lockInByPlayer = await getLockInGroupIdByPlayerIds(input.gameId, courtPlayerIds);
  if (playerIdsIncludeLockInPair(courtPlayerIds.map(String), lockInByPlayer)) {
    throw new Error(LOCKED_IN_LINEUP_LOCKED_MESSAGE);
  }

  const previousPlayerId = team.playerIds[input.slotIndex];
  const previousQueueEntryId = team.queueEntryIds[input.slotIndex];

  team.playerIds[input.slotIndex] = queuedEntry.playerId as Types.ObjectId;
  team.queueEntryIds[input.slotIndex] = queuedEntry._id;
  court.markModified(teamKey);

  const reordered = [
    ...queue.slice(0, input.targetIndex),
    courtEntry,
    ...queue.slice(input.targetIndex + 1),
  ];

  // Promote the waiting player first while the outgoing player is still listed on the court,
  // then persist the court swap, then demote the outgoing player — never orphan on_court.
  const promoted = await QueueEntry.findOneAndUpdate(
    { _id: queuedEntry._id, gameId: input.gameId, status: "queued" },
    { $set: { status: "on_court" } },
    { returnDocument: "after" },
  );
  if (!promoted) {
    throw new Error("Selected player is not in the queue.");
  }

  try {
    await court.save();
  } catch (error) {
    await QueueEntry.updateOne(
      { _id: queuedEntry._id, gameId: input.gameId, status: "on_court" },
      { $set: { status: "queued" } },
    );
    team.playerIds[input.slotIndex] = previousPlayerId;
    team.queueEntryIds[input.slotIndex] = previousQueueEntryId;
    court.markModified(teamKey);
    throw error;
  }

  const demoted = await QueueEntry.findOneAndUpdate(
    { _id: courtEntry._id, gameId: input.gameId, status: "on_court" },
    { $set: { status: "queued" } },
    { returnDocument: "after" },
  );
  if (!demoted) {
    // Court already shows the incoming player; heal path will recover if needed.
    await healOrphanedOnCourtEntries(input.gameId);
    throw new Error("Court player queue entry not found.");
  }

  await persistQueueOrder(reordered);

  return court;
}

function leaderboardFinishedMatchUpdate(hasWon: boolean) {
  return [
    {
      $set: {
        gamesPlayed: { $add: [{ $ifNull: ["$gamesPlayed", 0] }, 1] },
        wins: { $add: [{ $ifNull: ["$wins", 0] }, hasWon ? 1 : 0] },
        losses: { $add: [{ $ifNull: ["$losses", 0] }, hasWon ? 0 : 1] },
        currentStreak: { $add: [{ $ifNull: ["$currentStreak", 0] }, hasWon ? 1 : -1] },
      },
    },
    {
      $set: {
        winRate: {
          $cond: [
            { $gt: ["$gamesPlayed", 0] },
            { $round: [{ $multiply: [{ $divide: ["$wins", "$gamesPlayed"] }, 100] }, 0] },
            0,
          ],
        },
      },
    },
  ];
}

export async function incrementLeaderboardForFinishedCourt(input: {
  gameId: string;
  playerIds: Types.ObjectId[];
  winnerPlayerIdSet: Set<string>;
}) {
  if (input.playerIds.length === 0) return;
  await LeaderboardStats.bulkWrite(
    input.playerIds.map((playerId) => ({
      updateOne: {
        filter: { gameId: input.gameId, playerId },
        update: leaderboardFinishedMatchUpdate(input.winnerPlayerIdSet.has(playerId.toString())),
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

export type FinishedCourtLeaderboardInput = {
  gameId: string;
  playerIds: Types.ObjectId[];
  winnerPlayerIdSet: Set<string>;
};

export async function endGameAndRequeue(
  input: {
    gameId: string;
    courtNumber: number;
    winnerTeam: "A" | "B";
    teamAScore: number;
    teamBScore: number;
    rematch?: boolean;
  },
  options?: {
    /** Called after the court is free so fill can start before win rates finish. */
    onCourtReady?: (leaderboard: FinishedCourtLeaderboardInput) => void;
  },
) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
  });
  if (!court) throw new Error("Active court not found.");
  if (court.status !== "active") {
    return {
      ok: true,
      rematch: false,
      alreadyEnded: true,
      requeueMode: "standard" as const,
      message: "Game ended and players returned to the queue.",
    };
  }

  const winnerPlayers = input.winnerTeam === "A" ? court.teamA.playerIds : court.teamB.playerIds;
  const loserPlayers = input.winnerTeam === "A" ? court.teamB.playerIds : court.teamA.playerIds;
  const winnerPlayerIdSet = new Set(winnerPlayers.map((id: Types.ObjectId) => id.toString()));
  const courtPlayers = [...winnerPlayers, ...loserPlayers].map(
    (id) => new Types.ObjectId(String(id)),
  );
  const leaderboardInput: FinishedCourtLeaderboardInput = {
    gameId: input.gameId,
    playerIds: courtPlayers,
    winnerPlayerIdSet,
  };

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

  const [game] = await Promise.all([
    PickleGame.findOne({ gameId: input.gameId }).select("gameMode matchingType"),
    MatchHistory.create({
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
    }),
  ]);

  const finishLeaderboard = async () => {
    if (options?.onCourtReady) {
      options.onCourtReady(leaderboardInput);
      return;
    }
    await incrementLeaderboardForFinishedCourt(leaderboardInput);
  };

  if (input.rematch) {
    court.startedAt = new Date();
    Object.assign(court, clearCourtTimerPauseFields());
    court.isRematch = true;
    court.markModified("isRematch");
    await court.save();
    await finishLeaderboard();
    return {
      ok: true,
      rematch: true,
      message: `Court ${input.courtNumber} rematch started — same players, fresh clock.`,
    };
  }

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
  await finishLeaderboard();

  return requeueResult;
}
