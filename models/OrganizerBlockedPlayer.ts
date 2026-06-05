import mongoose, { Schema, model, models } from "mongoose";

const organizerBlockedPlayerSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

organizerBlockedPlayerSchema.index({ ownerId: 1, email: 1 }, { unique: true });

if (models.OrganizerBlockedPlayer) {
  delete models.OrganizerBlockedPlayer;
}

export const OrganizerBlockedPlayer = model("OrganizerBlockedPlayer", organizerBlockedPlayerSchema);
