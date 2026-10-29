import mongoose, { Schema } from "mongoose";

/** One row per visitor, page and day; `views` counts repeat loads so unique visitors stay countable. */
const pageVisitSchema = new Schema(
  {
    /** Day key (YYYY-MM-DD) in the club's timezone. */
    day: { type: String, required: true },
    visitorId: { type: String, required: true },
    path: { type: String, required: true },
    views: { type: Number, default: 1 },
    ip: { type: String, default: "" },
    country: { type: String, default: "" },
    region: { type: String, default: "" },
    city: { type: String, default: "" },
    device: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

pageVisitSchema.index({ day: 1, visitorId: 1, path: 1 }, { unique: true });
pageVisitSchema.index({ day: 1, path: 1 });
pageVisitSchema.index({ visitorId: 1, lastSeenAt: -1 });
// Keep roughly a year of traffic.
pageVisitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 400 });

if (mongoose.models.PageVisit) {
  mongoose.deleteModel("PageVisit");
}

export const PageVisit = mongoose.model("PageVisit", pageVisitSchema);
