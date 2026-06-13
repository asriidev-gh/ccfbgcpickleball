import mongoose, { Schema } from "mongoose";

const prayerRequestReplySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    prayerRequestId: {
      type: Schema.Types.ObjectId,
      ref: "PrayerRequest",
      required: true,
      index: true,
    },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

prayerRequestReplySchema.index({ prayerRequestId: 1, createdAt: -1 });
prayerRequestReplySchema.index({ ownerId: 1, playerId: 1, createdAt: -1 });

if (mongoose.models.PrayerRequestReply) {
  mongoose.deleteModel("PrayerRequestReply");
}

export const PrayerRequestReply = mongoose.model("PrayerRequestReply", prayerRequestReplySchema);
