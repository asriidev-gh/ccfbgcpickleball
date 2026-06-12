import { nanoid } from "nanoid";
import { Types } from "mongoose";

import { COURT_CANCEL_GRACE_MS } from "@/lib/court-cancel-grace";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { QueueEntry } from "@/models/QueueEntry";

export async function startGameOnCourt(gameId: string, courtNumber?: number) {
  const court =
    courtNumber != null
      ? await Court.findOne({ gameId, courtNumber, status: "empty" })
      : await Court.findOne({ gameId, status: "empty" }).sort({ courtNumber: 1 });
  if (!court) {
    throw new Error(
      courtNumber != null
        ? `Court ${courtNumber} is not available.`
        : "No empty court available.",
    );
  }

  const entries = await QueueEntry.find({ gameId, status: "queued" }).sort({ registeredAt: 1 }).limit(4);
  if (entries.length < 4) {
    throw new Error("Not enough queued players. At least 4 players are required.");
  }

  const [p1, p2, p3, p4] = entries;
  await QueueEntry.updateMany(
    { _id: { $in: entries.map((entry) => entry._id) } },
    { $set: { status: "on_court" } },
  );

  court.status = "active";
  court.startedAt = new Date();
  court.isRematch = false;
  court.teamA = { playerIds: [p1.playerId, p2.playerId], queueEntryIds: [p1._id, p2._id] };
  court.teamB = { playerIds: [p3.playerId, p4.playerId], queueEntryIds: [p3._id, p4._id] };
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
    if (seen.has(entryId)) {
      throw new Error("Queue order must include every queued player exactly once.");
    }
    seen.add(entryId);
    const entry = byId.get(entryId);
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

  const elapsedMs = Date.now() - new Date(court.startedAt).getTime();
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

  const elapsedMs = Date.now() - new Date(court.startedAt).getTime();
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
  const startedAt = court.startedAt ? new Date(court.startedAt) : endedAt;
  const durationSeconds = court.startedAt
    ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
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
        { upsert: true, new: true },
      );
    }),
  );

  await recalculateLeaderboardWinRates(input.gameId);

  if (input.rematch) {
    court.startedAt = new Date();
    court.isRematch = true;
    court.markModified("isRematch");
    await court.save();
    return {
      ok: true,
      rematch: true,
      message: `Court ${input.courtNumber} rematch started — same players, fresh clock.`,
    };
  }

  const teamAPlayers = [...court.teamA.playerIds];
  const teamBPlayers = [...court.teamB.playerIds];
  const requeueOrder: Types.ObjectId[] = [
    teamAPlayers[0],
    teamBPlayers[0],
    teamAPlayers[1],
    teamBPlayers[1],
  ].filter(Boolean) as Types.ObjectId[];

  const winnerPairGroupId = `W-${nanoid(8)}`;
  const loserPairGroupId = `L-${nanoid(8)}`;
  const now = new Date();

  await QueueEntry.insertMany(
    requeueOrder.map((playerId: Types.ObjectId, index: number) => {
      const isWinner = winnerPlayerIdSet.has(playerId.toString());
      return {
        gameId: input.gameId,
        playerId,
        status: "queued",
        queueType: isWinner ? "winner" : "loser",
        pairGroupId: isWinner ? winnerPairGroupId : loserPairGroupId,
        registeredAt: new Date(now.getTime() + index),
        lastMatchResult: isWinner ? "win" : "loss",
        winStreak: isWinner ? 1 : 0,
      };
    }),
  );

  await QueueEntry.updateMany(
    { _id: { $in: [...court.teamA.queueEntryIds, ...court.teamB.queueEntryIds] } },
    { $set: { status: "done" } },
  );

  court.status = "empty";
  court.teamA = { playerIds: [], queueEntryIds: [] };
  court.teamB = { playerIds: [], queueEntryIds: [] };
  court.startedAt = null;
  court.isRematch = false;
  await court.save();

  return {
    ok: true,
    rematch: false,
    message: "Game ended and players returned to the queue.",
  };
}
