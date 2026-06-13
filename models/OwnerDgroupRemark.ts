import mongoose, { Schema } from "mongoose";

const ownerDgroupRemarkSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

ownerDgroupRemarkSchema.index({ ownerId: 1, playerId: 1, createdAt: -1 });

if (mongoose.models.OwnerDgroupRemark) {
  mongoose.deleteModel("OwnerDgroupRemark");
}

export const OwnerDgroupRemark = mongoose.model("OwnerDgroupRemark", ownerDgroupRemarkSchema);
