import { Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Optional: Google-only accounts won't have a local password.
    passwordHash: { type: String },
    googleId: { type: String, index: true, sparse: true },
    image: { type: String },
    userType: {
      type: String,
      enum: ["default", "ccf"],
      default: "default",
    },
    registrationFeature: {
      type: String,
      enum: ["default", "qr_id"],
      default: "qr_id",
    },
    /** Custom header on player QR downloads (max 20 chars). Empty uses default branding. */
    playerQrTitle: { type: String, trim: true, maxlength: 20, default: "" },
    clubName: { type: String, trim: true, maxlength: 80, default: "" },
    clubTagline: { type: String, trim: true, maxlength: 120, default: "" },
    clubAdditionalInfo: { type: String, trim: true, maxlength: 300, default: "" },
    clubMissionVision: { type: String, trim: true, maxlength: 2000, default: "" },
    clubLogoUrl: { type: String, trim: true, default: "" },
    clubLogoPublicId: { type: String, trim: true, default: "" },
    clubFacebookUrl: { type: String, trim: true, maxlength: 240, default: "" },
    clubInstagramUrl: { type: String, trim: true, maxlength: 240, default: "" },
    clubAddress: { type: String, trim: true, maxlength: 500, default: "" },
    clubGoogleMapEmbedUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    clubOrganizers: {
      type: [
        {
          name: { type: String, trim: true, maxlength: 80, default: "" },
          photoUrl: { type: String, trim: true, default: "" },
          photoPublicId: { type: String, trim: true, default: "" },
        },
      ],
      default: [],
    },
    /** When true, embed club logo in player QR downloads. Undefined defaults to on when a logo exists. */
    playerQrIncludeClubLogo: { type: Boolean },
    linkedPlayerId: { type: Schema.Types.ObjectId, ref: "Player", index: true, sparse: true },
    registeredDevice: { type: String, trim: true },
    lastLoginAt: { type: Date },
    lastLoginDevice: { type: String, trim: true },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

if (models.User) {
  delete models.User;
}

export const User = model("User", userSchema);
