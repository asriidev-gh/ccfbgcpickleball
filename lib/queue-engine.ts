import { nanoid } from "nanoid";
import { Types } from "mongoose";

import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { QueueEntry } from "@/models/QueueEntry";

export async function startGameOnFirstAvailableCourt(gameId: string) {
  const court = await Court.findOne({ gameId, status: "empty" }).sort({ courtNumber: 1 });
  if (!court) {
    throw new Error("No empty court available.");
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
  court.teamA = { playerIds: [p1.playerId, p2.playerId], queueEntryIds: [p1._id, p2._id] };
  court.teamB = { playerIds: [p3.playerId, p4.playerId], queueEntryIds: [p3._id, p4._id] };
  await court.save();

  return court;
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

export async function endGameAndRequeue(input: {
  gameId: string;
  courtNumber: number;
  winnerTeam: "A" | "B";
  teamAScore?: number;
  teamBScore?: number;
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

  await QueueEntry.create(
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

  await MatchHistory.create({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    teamAPlayerIds: court.teamA.playerIds,
    teamBPlayerIds: court.teamB.playerIds,
    winnerTeam: input.winnerTeam,
    loserTeam: input.winnerTeam === "A" ? "B" : "A",
    teamAScore: input.teamAScore ?? null,
    teamBScore: input.teamBScore ?? null,
    durationSeconds: court.startedAt
      ? Math.floor((Date.now() - new Date(court.startedAt).getTime()) / 1000)
      : 0,
  });

  await Promise.all(
    [...winnerPlayers, ...loserPlayers].map(async (playerId: Types.ObjectId) => {
      const hasWon = winnerPlayers.some((id: Types.ObjectId) => id.toString() === playerId.toString());
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

  await QueueEntry.updateMany(
    { _id: { $in: [...court.teamA.queueEntryIds, ...court.teamB.queueEntryIds] } },
    { $set: { status: "done" } },
  );

  court.status = "empty";
  court.teamA = { playerIds: [], queueEntryIds: [] };
  court.teamB = { playerIds: [], queueEntryIds: [] };
  court.startedAt = null;
  await court.save();

  const allStats = await LeaderboardStats.find({ gameId: input.gameId });
  await Promise.all(
    allStats.map(async (stat) => {
      stat.winRate = stat.gamesPlayed > 0 ? Math.round((stat.wins / stat.gamesPlayed) * 100) : 0;
      await stat.save();
    }),
  );

  return { ok: true };
}
