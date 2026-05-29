import { Schema, model, models } from "mongoose";

const volunteerSchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    gameId: { type: String, required: true, index: true },
    volunteerType: {
      type: String,
      enum: ["Pickleball", "Running", "Badminton", "Other"],
      required: true,
    },
    volunteerTypeOther: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Volunteer = models.Volunteer || model("Volunteer", volunteerSchema);
