import { Schema, model, models } from "mongoose";

const playerSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    personalQrCode: { type: String, required: true, unique: true },
    firstTimeSportsMinistry: { type: Boolean, default: false },
    isPartOfDgroup: { type: Boolean, default: false },
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

export const Player = models.Player || model("Player", playerSchema);
