import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getAuthCookieName, signAuthToken } from "@/lib/auth";
import { normalizeClubSlug, validateClubSlug } from "@/lib/club-signup-shared";
import { runWithDatabase } from "@/lib/db";
import { sendAccountWelcomeVerificationEmail } from "@/lib/account-welcome-email";
import { REGISTRATION_FEATURE_QR_ID } from "@/lib/registration-feature";
import { USER_TYPE_DEFAULT } from "@/lib/registration-variant";
import { getRegistrationDevice } from "@/lib/user-auth-audit";
import { issueEmailVerificationForUser } from "@/lib/user-email-verification";
import { User } from "@/models/User";

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const body = await request.json();
      const clubName = String(body?.clubName ?? "").trim();
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      const clubSlug = normalizeClubSlug(String(body?.clubSlug ?? ""));

      if (!clubName) {
        return NextResponse.json({ message: "Club name is required." }, { status: 400 });
      }

      if (!email) {
        return NextResponse.json({ message: "Recovery email is required." }, { status: 400 });
      }

      const slugError = validateClubSlug(clubSlug);
      if (slugError) {
        return NextResponse.json({ message: slugError }, { status: 400 });
      }

      if (password.length < 6) {
        return NextResponse.json(
          { message: "Password must be at least 6 characters." },
          { status: 400 },
        );
      }

      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return NextResponse.json({ message: "That recovery email is already registered." }, { status: 400 });
      }

      const slugExists = await User.findOne({ clubSlug });
      if (slugExists) {
        return NextResponse.json({ message: "That club link is already taken." }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const device = getRegistrationDevice(request);
      const now = new Date();
      const user = await User.create({
        name: clubName,
        clubName,
        clubSlug,
        email,
        passwordHash,
        userType: USER_TYPE_DEFAULT,
        registrationFeature: REGISTRATION_FEATURE_QR_ID,
        registeredDevice: device,
        lastLoginAt: now,
        lastLoginDevice: device,
        emailVerified: false,
      });

      const { token: verificationToken } = await issueEmailVerificationForUser(user._id.toString());
      void sendAccountWelcomeVerificationEmail({
        to: email,
        name: clubName,
        verificationToken,
      }).catch(() => {
        // Registration still succeeds if email delivery fails.
      });

      const token = signAuthToken({ userId: user._id.toString(), email: user.email, name: user.name });

      const response = NextResponse.json({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          clubName: user.clubName,
          clubSlug: user.clubSlug,
          emailVerified: false,
        },
      });
      response.cookies.set(getAuthCookieName(), token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create club." },
      { status: 400 },
    );
  }
}
