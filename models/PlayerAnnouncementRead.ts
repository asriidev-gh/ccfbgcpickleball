import mongoose, { Schema } from "mongoose";

const playerAnnouncementReadSchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    announcementId: {
      type: Schema.Types.ObjectId,
      ref: "ClubAnnouncement",
      required: true,
      index: true,
    },
    readAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

playerAnnouncementReadSchema.index({ playerId: 1, announcementId: 1 }, { unique: true });

if (mongoose.models.PlayerAnnouncementRead) {
  mongoose.deleteModel("PlayerAnnouncementRead");
}

export const PlayerAnnouncementRead = mongoose.model(
  "PlayerAnnouncementRead",
  playerAnnouncementReadSchema,
);
