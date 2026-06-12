import mongoose, { Schema } from "mongoose";

const operatorDashboardLeaseSchema = new Schema(
  {
    gameId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    leaseId: { type: String, required: true },
    deviceHint: { type: String, trim: true },
    lastHeartbeatAt: { type: Date, required: true, default: Date.now },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

if (mongoose.models.OperatorDashboardLease) {
  mongoose.deleteModel("OperatorDashboardLease");
}

export const OperatorDashboardLease = mongoose.model(
  "OperatorDashboardLease",
  operatorDashboardLeaseSchema,
);
