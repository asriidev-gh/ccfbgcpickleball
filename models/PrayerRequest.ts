import mongoose, { Schema } from "mongoose";

import { MAX_PRAYER_REQUEST_LENGTH } from "@/lib/owner-prayer-requests-shared";

const prayerRequestSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    gameId: { type: String, required: true, trim: true },
    requestText: { type: String, required: true, trim: true, maxlength: MAX_PRAYER_REQUEST_LENGTH },
    status: {
      type: String,
      enum: ["pending", "acknowledged", "dismissed"],
      default: "pending",
      index: true,
    },
    submittedAt: { type: Date, default: () => new Date() },
    playerViewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

prayerRequestSchema.index({ ownerId: 1, status: 1, submittedAt: -1 });

if (mongoose.models.PrayerRequest) {
  mongoose.deleteModel("PrayerRequest");
}

export const PrayerRequest = mongoose.model("PrayerRequest", prayerRequestSchema);
