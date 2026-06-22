import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getAuthCookieName, signAuthToken } from "@/lib/auth";
import { normalizeClubSlug } from "@/lib/club-signup-shared";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { BLOCKED_LOGIN_MESSAGE, isUserBlocked } from "@/lib/user-block";
import { recordUserLogin } from "@/lib/user-auth-audit";
import { User } from "@/models/User";

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const body = await request.json();
      const clubSlug = normalizeClubSlug(String(body?.clubSlug ?? ""));
      const password = String(body?.password ?? "");

      if (!clubSlug || !password) {
        return NextResponse.json({ message: "Club link and password are required." }, { status: 400 });
      }

      const user = await User.findOne({ clubSlug });
      if (!user) {
        return NextResponse.json({ message: "Invalid club link or password." }, { status: 401 });
      }

      if (isUserBlocked(user)) {
        return NextResponse.json({ message: BLOCKED_LOGIN_MESSAGE }, { status: 403 });
      }

      if (!user.passwordHash) {
        return NextResponse.json(
          { message: "This club uses Google sign-in. Please continue with Google." },
          { status: 401 },
        );
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ message: "Invalid club link or password." }, { status: 401 });
      }

      await recordUserLogin(user._id.toString(), request);

      const token = signAuthToken({ userId: user._id.toString(), email: user.email, name: user.name });
      const response = NextResponse.json({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          clubName: user.clubName,
          clubSlug: user.clubSlug,
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
    const message = error instanceof Error ? error.message : "";
    if (/mongodb|connection failed|must be connected/i.test(message)) {
      return handleApiError(error, {
        source: "api/auth/club-login",
        request,
        status: 503,
        message: "Unable to sign in right now. Please try again in a moment.",
      });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to join club." },
      { status: 400 },
    );
  }
}
