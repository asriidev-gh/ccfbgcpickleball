import mongoose, { Schema } from "mongoose";

const playerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    personalQrCode: { type: String, required: true, unique: true },
    firstTimeSportsMinistry: { type: Boolean, default: false },
    isPartOfDgroup: { type: Boolean, default: false },
    wantsToJoinDgroup: { type: Boolean, default: null },
    attendedEvents: { type: [String], default: [] },
    attendedEventsOther: { type: String, default: "" },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastAttendedAt: { type: Date },
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
  },
  { timestamps: true }
);

if (mongoose.models.Player) {
  mongoose.deleteModel("Player");
}

export const Player = mongoose.model("Player", playerSchema);
