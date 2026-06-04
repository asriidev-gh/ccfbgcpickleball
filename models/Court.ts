import mongoose, { Schema, model, models } from "mongoose";

const teamSchema = new Schema(
  {
    playerIds: [{ type: Schema.Types.ObjectId, ref: "Player" }],
    queueEntryIds: [{ type: Schema.Types.ObjectId, ref: "QueueEntry" }],
  },
  { _id: false }
);

const courtSchema = new Schema(
  {
    gameId: { type: String, required: true, index: true },
    courtNumber: { type: Number, required: true },
    status: { type: String, enum: ["empty", "active"], default: "empty" },
    teamA: { type: teamSchema, default: { playerIds: [], queueEntryIds: [] } },
    teamB: { type: teamSchema, default: { playerIds: [], queueEntryIds: [] } },
    startedAt: { type: Date, default: null },
    /** True when the current court session started via rematch (not queue fill). */
    isRematch: { type: Boolean, default: false },
  },
  { timestamps: true }
);

courtSchema.index({ gameId: 1, courtNumber: 1 }, { unique: true });

if (models.Court) {
  mongoose.deleteModel("Court");
}

export const Court = model("Court", courtSchema);
