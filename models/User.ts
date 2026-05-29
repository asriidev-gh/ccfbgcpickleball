import { Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    userType: {
      type: String,
      enum: ["default", "ccf"],
      default: "default",
    },
  },
  { timestamps: true }
);

if (models.User) {
  delete models.User;
}

export const User = model("User", userSchema);
