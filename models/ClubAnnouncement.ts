import mongoose, { Schema } from "mongoose";

const clubAnnouncementSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 20000 },
    isPublished: { type: Boolean, default: true },
    publishedAt: { type: Date, default: () => new Date() },
    postingDate: { type: String, default: null, maxlength: 10 },
    expirationDate: { type: String, default: null, maxlength: 10 },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

clubAnnouncementSchema.index({ ownerId: 1, publishedAt: -1 });

if (mongoose.models.ClubAnnouncement) {
  mongoose.deleteModel("ClubAnnouncement");
}

export const ClubAnnouncement = mongoose.model("ClubAnnouncement", clubAnnouncementSchema);
