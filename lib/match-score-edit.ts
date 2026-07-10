import { Types } from "mongoose";

import { inferWinnerTeamFromScores, TIED_MATCH_SCORE_MESSAGE } from "@/lib/match-score-validation";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";

async function recalculateLeaderboardWinRates(gameId: string) {
  const allStats = await LeaderboardStats.find({ gameId });
  await Promise.all(
    allStats.map(async (stat) => {
      stat.gamesPlayed = Math.max(0, stat.gamesPlayed);
      stat.wins = Math.max(0, stat.wins);
      stat.losses = Math.max(0, stat.losses);
      stat.winRate =
        stat.gamesPlayed > 0 ? Math.round((stat.wins / stat.gamesPlayed) * 100) : 0;
      await stat.save();
    }),
  );
}

async function flipMatchWinnerLeaderboardStats(input: {
  gameId: string;
  previousWinnerTeam: "A" | "B";
  newWinnerTeam: "A" | "B";
  teamAPlayerIds: Types.ObjectId[];
  teamBPlayerIds: Types.ObjectId[];
}) {
  if (input.previousWinnerTeam === input.newWinnerTeam) return;

  const previousWinners =
    input.previousWinnerTeam === "A" ? input.teamAPlayerIds : input.teamBPlayerIds;
  const previousLosers =
    input.previousWinnerTeam === "A" ? input.teamBPlayerIds : input.teamAPlayerIds;

  await Promise.all([
    ...previousWinners.map((playerId) =>
      LeaderboardStats.findOneAndUpdate(
        { gameId: input.gameId, playerId },
        { $inc: { wins: -1, losses: 1, currentStreak: -1 } },
      ),
    ),
    ...previousLosers.map((playerId) =>
      LeaderboardStats.findOneAndUpdate(
        { gameId: input.gameId, playerId },
        { $inc: { wins: 1, losses: -1, currentStreak: 1 } },
      ),
    ),
  ]);

  await recalculateLeaderboardWinRates(input.gameId);
}

export async function editMatchScore(input: {
  gameId: string;
  matchId: string;
  teamAScore: number;
  teamBScore: number;
}) {
  const winnerTeam = inferWinnerTeamFromScores(input.teamAScore, input.teamBScore);
  if (!winnerTeam) {
    throw new Error(TIED_MATCH_SCORE_MESSAGE);
  }

  const existing = await MatchHistory.findOne({ _id: input.matchId, gameId: input.gameId }).select(
    "winnerTeam teamAPlayerIds teamBPlayerIds",
  );
  if (!existing) throw new Error("Match not found.");

  if (existing.winnerTeam !== winnerTeam) {
    await flipMatchWinnerLeaderboardStats({
      gameId: input.gameId,
      previousWinnerTeam: existing.winnerTeam,
      newWinnerTeam: winnerTeam,
      teamAPlayerIds: existing.teamAPlayerIds,
      teamBPlayerIds: existing.teamBPlayerIds,
    });
  }

  const match = await MatchHistory.findOneAndUpdate(
    { _id: input.matchId, gameId: input.gameId },
    {
      $set: {
        teamAScore: input.teamAScore,
        teamBScore: input.teamBScore,
        winnerTeam,
        loserTeam: winnerTeam === "A" ? "B" : "A",
      },
    },
    { returnDocument: "after" },
  );
  if (!match) throw new Error("Match not found.");

  return match;
}
