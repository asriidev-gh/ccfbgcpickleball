import { Schema, model, models } from "mongoose";

const leaderboardStatsSchema = new Schema(
  {
    gameId: { type: String, required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
  },
  { timestamps: true }
);

leaderboardStatsSchema.index({ gameId: 1, playerId: 1 }, { unique: true });

export const LeaderboardStats =
  models.LeaderboardStats || model("LeaderboardStats", leaderboardStatsSchema);
