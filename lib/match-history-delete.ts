import { Types } from "mongoose";

import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";

export async function deleteMatchFromHistory(input: { gameId: string; matchId: string }) {
  const match = await MatchHistory.findOne({ _id: input.matchId, gameId: input.gameId });
  if (!match) throw new Error("Match not found.");

  const winnerPlayers =
    match.winnerTeam === "A" ? match.teamAPlayerIds : match.teamBPlayerIds;
  const winnerSet = new Set(winnerPlayers.map((id: Types.ObjectId) => id.toString()));
  const allPlayers = [...match.teamAPlayerIds, ...match.teamBPlayerIds];

  await MatchHistory.deleteOne({ _id: match._id });

  await Promise.all(
    allPlayers.map(async (playerId: Types.ObjectId) => {
      const hasWon = winnerSet.has(playerId.toString());
      await LeaderboardStats.findOneAndUpdate(
        { gameId: input.gameId, playerId },
        {
          $inc: {
            gamesPlayed: -1,
            wins: hasWon ? -1 : 0,
            losses: hasWon ? 0 : -1,
            currentStreak: hasWon ? -1 : 1,
          },
        },
      );
    }),
  );

  const allStats = await LeaderboardStats.find({ gameId: input.gameId });
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

  return { ok: true };
}
