import mongoose, { Schema } from "mongoose";

const pickleGameSchema = new Schema(
  {
    title: { type: String, required: true },
    gameId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    openPlayType: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      required: true,
    },
    courtCount: { type: Number, required: true, min: 1 },
    expectedPlayers: { type: Number, required: true, min: 4 },
    strictPlayerCount: { type: Boolean, required: true, default: false },
    allowQrRegistration: { type: Boolean, required: true, default: true },
    registrationMode: {
      type: String,
      enum: ["self", "owner"],
      default: "self",
    },
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
