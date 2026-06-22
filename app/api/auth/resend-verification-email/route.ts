import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { sendAccountWelcomeVerificationEmail } from "@/lib/account-welcome-email";
import { runWithDatabase } from "@/lib/db";
import {
  isUserEmailVerified,
  issueEmailVerificationForUser,
} from "@/lib/user-email-verification";
import { User } from "@/models/User";

export async function POST() {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }

      const user = await User.findById(authUser.userId)
        .select("name email emailVerified googleId")
        .lean();
      if (!user) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      if (isUserEmailVerified(user)) {
        return NextResponse.json({ message: "Your email is already verified." });
      }

      const { token: verificationToken } = await issueEmailVerificationForUser(authUser.userId);
      const emailResult = await sendAccountWelcomeVerificationEmail({
        to: user.email,
        name: user.name,
        verificationToken,
      });

      if (!emailResult.ok) {
        return NextResponse.json({ message: emailResult.message }, { status: 503 });
      }

      return NextResponse.json({ message: "Verification email sent." });
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to send verification email.",
      },
      { status: 400 },
    );
  }
}
