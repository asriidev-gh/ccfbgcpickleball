import mongoose, { Schema, model, models } from "mongoose";

const matchHistorySchema = new Schema(
  {
    gameId: { type: String, required: true, index: true },
    courtNumber: { type: Number, required: true },
    teamAPlayerIds: [{ type: Schema.Types.ObjectId, ref: "Player", required: true }],
    teamBPlayerIds: [{ type: Schema.Types.ObjectId, ref: "Player", required: true }],
    winnerTeam: { type: String, enum: ["A", "B"], required: true },
    loserTeam: { type: String, enum: ["A", "B"], required: true },
    teamAScore: { type: Number, default: null },
    teamBScore: { type: Number, default: null },
    durationSeconds: { type: Number, default: 0 },
    endedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

if (models.MatchHistory) {
  mongoose.deleteModel("MatchHistory");
}

export const MatchHistory = model("MatchHistory", matchHistorySchema);
