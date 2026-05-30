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
    registeredDevice: { type: String, trim: true },
    lastLoginAt: { type: Date },
    lastLoginDevice: { type: String, trim: true },
  },
  { timestamps: true }
);

if (models.User) {
  delete models.User;
}

export const User = model("User", userSchema);
