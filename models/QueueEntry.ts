import mongoose, { Schema, model, models } from "mongoose";

const queueEntrySchema = new Schema(
  {
    gameId: { type: String, required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    status: {
      type: String,
      enum: ["queued", "on_court", "done", "checked_out"],
      default: "queued",
    },
    queueType: {
      type: String,
      enum: ["normal", "winner", "loser"],
      default: "normal",
    },
    pairGroupId: { type: String, default: null },
    registeredAt: { type: Date, required: true, default: () => new Date() },
    winStreak: { type: Number, default: 0 },
    lastMatchResult: { type: String, enum: ["win", "loss", "none"], default: "none" },
  },
  { timestamps: true }
);

queueEntrySchema.index({ gameId: 1, status: 1, registeredAt: 1 });

/** Re-register in dev so schema enum changes (e.g. checked_out) apply without a full restart. */
if (models.QueueEntry) {
  delete mongoose.models.QueueEntry;
}

export const QueueEntry = model("QueueEntry", queueEntrySchema);
