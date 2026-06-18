import mongoose, { Schema } from "mongoose";

const systemLogSchema = new Schema(
  {
    level: { type: String, enum: ["error", "warn", "info"], required: true, index: true },
    source: { type: String, required: true, trim: true, index: true },
    message: { type: String, required: true, trim: true },
    stack: { type: String },
    route: { type: String, trim: true },
    method: { type: String, trim: true },
    statusCode: { type: Number },
    userId: { type: String, trim: true, index: true },
    userEmail: { type: String, trim: true },
    userName: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date, default: null, index: true },
    resolvedByUserId: { type: String, trim: true, default: "" },
    resolvedByEmail: { type: String, trim: true, default: "" },
  },
  { timestamps: false },
);

systemLogSchema.index({ occurredAt: -1 });
// Keep roughly 30 days of logs on Atlas free/flex tiers.
systemLogSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

if (mongoose.models.SystemLog) {
  mongoose.deleteModel("SystemLog");
}

export const SystemLog = mongoose.model("SystemLog", systemLogSchema);
