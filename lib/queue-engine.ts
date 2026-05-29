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

  const slotIndex = input.slotIndex ?? 0;

  const teamAPlayers = [...court.teamA.playerIds];
  const teamBPlayers = [...court.teamB.playerIds];
  const teamAEntries = [...court.teamA.queueEntryIds];
  const teamBEntries = [...court.teamB.queueEntryIds];

  if (
    teamAPlayers.length <= slotIndex ||
    teamBPlayers.length <= slotIndex ||
    teamAEntries.length <= slotIndex ||
    teamBEntries.length <= slotIndex
  ) {
    throw new Error("Both teams need a player in that position to swap.");
  }

  const playerA = teamAPlayers[slotIndex];
  const playerB = teamBPlayers[slotIndex];
  const entryA = teamAEntries[slotIndex];
  const entryB = teamBEntries[slotIndex];

  teamAPlayers[slotIndex] = playerB;
  teamBPlayers[slotIndex] = playerA;
  teamAEntries[slotIndex] = entryB;
  teamBEntries[slotIndex] = entryA;

  court.teamA = { playerIds: teamAPlayers, queueEntryIds: teamAEntries };
  court.teamB = { playerIds: teamBPlayers, queueEntryIds: teamBEntries };
  court.markModified("teamA");
  court.markModified("teamB");
  await court.save();

  return court;
}

export async function endGameAndRequeue(input: {
  gameId: string;
  courtNumber: number;
  winnerTeam: "A" | "B";
}) {
  const court = await Court.findOne({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    status: "active",
  });
  if (!court) throw new Error("Active court not found.");

  const winnerPlayers = input.winnerTeam === "A" ? court.teamA.playerIds : court.teamB.playerIds;
  const loserPlayers = input.winnerTeam === "A" ? court.teamB.playerIds : court.teamA.playerIds;

  const winnerPairGroupId = `W-${nanoid(8)}`;
  const loserPairGroupId = `L-${nanoid(8)}`;
  const now = new Date();

  await QueueEntry.create([
    ...winnerPlayers.map((playerId: Types.ObjectId) => ({
      gameId: input.gameId,
      playerId,
      status: "queued",
      queueType: "winner",
      pairGroupId: winnerPairGroupId,
      registeredAt: now,
      lastMatchResult: "win",
      winStreak: 1,
    })),
    ...loserPlayers.map((playerId: Types.ObjectId) => ({
      gameId: input.gameId,
      playerId,
      status: "queued",
      queueType: "loser",
      pairGroupId: loserPairGroupId,
      registeredAt: now,
      lastMatchResult: "loss",
      winStreak: 0,
    })),
  ]);

  await MatchHistory.create({
    gameId: input.gameId,
    courtNumber: input.courtNumber,
    teamAPlayerIds: court.teamA.playerIds,
    teamBPlayerIds: court.teamB.playerIds,
    winnerTeam: input.winnerTeam,
    loserTeam: input.winnerTeam === "A" ? "B" : "A",
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
