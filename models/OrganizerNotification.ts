import mongoose, { Schema } from "mongoose";

const organizerNotificationSchema = new Schema(
  {
    gameId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ["checkin_attempt"],
      required: true,
    },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    playerName: { type: String, required: true, trim: true },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: false },
);

organizerNotificationSchema.index({ gameId: 1, occurredAt: -1 });

if (mongoose.models.OrganizerNotification) {
  mongoose.deleteModel("OrganizerNotification");
}

export const OrganizerNotification = mongoose.model(
  "OrganizerNotification",
  organizerNotificationSchema,
);
