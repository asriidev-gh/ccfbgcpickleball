import mongoose, { Schema, model, models } from "mongoose";

import type { OperatorFullPayload } from "@/lib/operator-payload";

export type QuickGameSaveReason = "create" | "checkpoint" | "end" | "exit";

const quickGameSessionSchema = new Schema(
  {
    gameId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["active", "ended"], default: "active", index: true },
    saveReason: {
      type: String,
      enum: ["create", "checkpoint", "end", "exit"],
      default: "create",
    },
    payload: { type: Schema.Types.Mixed, required: true },
    endedAt: { type: Date, default: null },
    lastSavedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

quickGameSessionSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });

if (models.QuickGameSession) {
  mongoose.deleteModel("QuickGameSession");
}

export const QuickGameSession = model("QuickGameSession", quickGameSessionSchema);

export type QuickGameSessionDocument = {
  gameId: string;
  ownerId: mongoose.Types.ObjectId;
  status: "active" | "ended";
  saveReason: QuickGameSaveReason;
  payload: OperatorFullPayload;
  endedAt?: Date | null;
  lastSavedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
