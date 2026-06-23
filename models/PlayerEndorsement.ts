import mongoose, { Schema } from "mongoose";

import { PLAYER_ENDORSEMENT_BADGES } from "@/lib/player-endorsement-shared";

const playerEndorsementSchema = new Schema(
  {
    gameId: { type: String, required: true, index: true, trim: true },
    endorserPlayerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    endorsedPlayerId: { type: Schema.Types.ObjectId, ref: "Player", required: true, index: true },
    badges: {
      type: [{ type: String, enum: PLAYER_ENDORSEMENT_BADGES }],
      default: [],
      validate: {
        validator: (value: string[]) => value.length > 0 && value.length <= 3,
        message: "Select 1 to 3 badges.",
      },
    },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true },
);

playerEndorsementSchema.index(
  { gameId: 1, endorserPlayerId: 1, endorsedPlayerId: 1 },
  { unique: true },
);

if (mongoose.models.PlayerEndorsement) {
  mongoose.deleteModel("PlayerEndorsement");
}

export const PlayerEndorsement = mongoose.model("PlayerEndorsement", playerEndorsementSchema);
