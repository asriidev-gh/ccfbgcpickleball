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
    welcomeEmailStatus: {
      type: String,
      enum: ["success", "failed", "skipped", ""],
      default: "",
    },
    welcomeEmailError: { type: String, trim: true, maxlength: 500, default: "" },
    welcomeEmailSentAt: { type: Date },
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    gender: {
      type: String,
      enum: ["male", "female", "prefer_not_to_say", ""],
      default: "",
    },
    birthdate: { type: Date },
    biography: { type: String, trim: true, maxlength: 500, default: "" },
    pickleballLevel: {
      type: String,
      enum: ["beginner", "low_intermediate", "high_intermediate", "advanced", "pro", ""],
      default: "",
    },
  },
  { timestamps: true }
);

if (mongoose.models.Player) {
  mongoose.deleteModel("Player");
}

export const Player = mongoose.model("Player", playerSchema);
