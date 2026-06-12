import { NextResponse } from "next/server";

import {
  getAuthCookieName,
  signAuthToken,
  verifyImpersonationToken,
} from "@/lib/auth";
import { normalizeBrowserOrigin } from "@/lib/browser-origin";
import { runWithDatabase } from "@/lib/db";
import { isSuperAdminUserId } from "@/lib/superadmin";
import { BLOCKED_LOGIN_MESSAGE, isUserBlocked } from "@/lib/user-block";
import { User } from "@/models/User";

export async function GET(request: Request) {
  const origin = normalizeBrowserOrigin(new URL(request.url).origin);
  const loginRedirect = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  try {

    return await runWithDatabase(async () => {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token) return loginRedirect("Missing impersonation token.");

    const { targetUserId, adminUserId } = verifyImpersonationToken(token);
    if (!(await isSuperAdminUserId(adminUserId))) {
      return loginRedirect("Impersonation link is no longer valid.");
    }
    const user = await User.findById(targetUserId).select("name email isBlocked").lean();
    if (!user) return loginRedirect("User not found.");
    if (isUserBlocked(user)) return loginRedirect(BLOCKED_LOGIN_MESSAGE);

    const authToken = signAuthToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.redirect(`${origin}/`);
    response.cookies.set(getAuthCookieName(), authToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;

    });} catch (error) {
    return loginRedirect(
      error instanceof Error ? error.message : "Failed to sign in as user.",
    );
  }
}
