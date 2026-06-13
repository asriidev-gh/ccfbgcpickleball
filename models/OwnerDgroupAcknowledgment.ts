import mongoose, { Schema } from "mongoose";

const ownerDgroupAcknowledgmentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    acknowledgedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

ownerDgroupAcknowledgmentSchema.index({ ownerId: 1, playerId: 1 }, { unique: true });

if (mongoose.models.OwnerDgroupAcknowledgment) {
  mongoose.deleteModel("OwnerDgroupAcknowledgment");
}

export const OwnerDgroupAcknowledgment = mongoose.model(
  "OwnerDgroupAcknowledgment",
  ownerDgroupAcknowledgmentSchema,
);
