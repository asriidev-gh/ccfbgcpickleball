import mongoose, { Schema, model, models, Types } from "mongoose";

const lockInGroupSchema = new Schema(
  {
    gameId: { type: String, required: true, index: true },
    groupId: { type: String, required: true },
    playerIds: [{ type: Schema.Types.ObjectId, ref: "Player", required: true }],
  },
  { timestamps: true },
);

lockInGroupSchema.index({ gameId: 1, groupId: 1 }, { unique: true });
lockInGroupSchema.index({ gameId: 1, playerIds: 1 });

if (models.LockInGroup) {
  delete models.LockInGroup;
}

export type LockInGroupDoc = {
  _id: Types.ObjectId;
  gameId: string;
  groupId: string;
  playerIds: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
};

export const LockInGroup = model("LockInGroup", lockInGroupSchema);
