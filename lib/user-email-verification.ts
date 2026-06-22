import crypto from "crypto";

import { User } from "@/models/User";

export const EMAIL_VERIFICATION_TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000;

export type EmailVerificationUserFields = {
  emailVerified?: boolean;
  googleId?: string | null;
};

export function isUserEmailVerified(user: EmailVerificationUserFields) {
  // Google-linked accounts are verified through Google (email_verified from provider).
  if (user.googleId) return true;
  return user.emailVerified === true;
}

export function generateEmailVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashEmailVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueEmailVerificationForUser(userId: string) {
  const token = generateEmailVerificationToken();
  const tokenHash = hashEmailVerificationToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY_MS);

  await User.findByIdAndUpdate(userId, {
    emailVerified: false,
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: expiresAt,
  });

  return { token, expiresAt };
}

export async function verifyEmailWithToken(token: string) {
  const tokenHash = hashEmailVerificationToken(token.trim());
  const now = new Date();

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: { $gt: now },
  });

  if (!user) {
    return { ok: false as const, message: "This verification link is invalid or has expired." };
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  return {
    ok: true as const,
    user: { id: user._id.toString(), email: user.email, name: user.name },
  };
}

export async function requireVerifiedEmailForUserId(userId: string) {
  const user = await User.findById(userId).select("emailVerified googleId").lean();
  if (!user) {
    return { ok: false as const, status: 401, message: "Unauthorized." };
  }
  if (!isUserEmailVerified(user)) {
    return {
      ok: false as const,
      status: 403,
      message: "Please verify your email before creating a game.",
    };
  }
  return { ok: true as const };
}
