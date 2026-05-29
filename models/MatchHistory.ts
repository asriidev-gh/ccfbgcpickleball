import { Schema, model, models } from "mongoose";

const matchHistorySchema = new Schema(
  {
    gameId: { type: String, required: true, index: true },
    courtNumber: { type: Number, required: true },
    teamAPlayerIds: [{ type: Schema.Types.ObjectId, ref: "Player", required: true }],
    teamBPlayerIds: [{ type: Schema.Types.ObjectId, ref: "Player", required: true }],
    winnerTeam: { type: String, enum: ["A", "B"], required: true },
    loserTeam: { type: String, enum: ["A", "B"], required: true },
    durationSeconds: { type: Number, default: 0 },
    endedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const MatchHistory = models.MatchHistory || model("MatchHistory", matchHistorySchema);
