import mongoose, { Schema } from "mongoose";

import { OPEN_PLAY_TYPES } from "@/lib/open-play-types";

const pickleGameSchema = new Schema(
  {
    title: { type: String, required: true },
    gameId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    openPlayType: {
      type: String,
      enum: [...OPEN_PLAY_TYPES],
      required: true,
    },
    openPlayDate: { type: Date },
    openPlayTimeRange: { type: String, trim: true },
    venueName: { type: String, trim: true, default: "" },
    venueAddress: { type: String, trim: true, default: "" },
    venueGoogleMapEmbedUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    courtCount: { type: Number, required: true, min: 1 },
    expectedPlayers: { type: Number, required: true, min: 4 },
    strictPlayerCount: { type: Boolean, required: true, default: false },
    allowQrRegistration: { type: Boolean, required: true, default: true },
    registrationMode: {
      type: String,
      enum: ["self", "owner"],
      default: "self",
    },
    allowManualPlayerAdd: { type: Boolean, required: true, default: false },
    liveQueue: { type: Boolean, required: true, default: true },
    registerUrl: { type: String, required: false },
    publicQrCodeDataUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "ended"],
      default: "active",
    },
  },
  { timestamps: true }
);

if (mongoose.models.PickleGame) {
  mongoose.deleteModel("PickleGame");
}

export const PickleGame = mongoose.model("PickleGame", pickleGameSchema);
