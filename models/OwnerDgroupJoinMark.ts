import mongoose, { Schema } from "mongoose";

const ownerDgroupJoinMarkSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    markedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

ownerDgroupJoinMarkSchema.index({ ownerId: 1, playerId: 1 }, { unique: true });
ownerDgroupJoinMarkSchema.index({ ownerId: 1, markedAt: -1 });

if (mongoose.models.OwnerDgroupJoinMark) {
  mongoose.deleteModel("OwnerDgroupJoinMark");
}

export const OwnerDgroupJoinMark = mongoose.model("OwnerDgroupJoinMark", ownerDgroupJoinMarkSchema);
