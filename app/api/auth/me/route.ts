import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthCookieName, getAuthUserFromCookie, verifyAuthToken } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { isSuperAdmin } from "@/lib/superadmin";
import { BLOCKED_LOGIN_MESSAGE, isUserBlocked } from "@/lib/user-block";
import { isUserEmailVerified } from "@/lib/user-email-verification";
import { User } from "@/models/User";

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  try {
    return await runWithDatabase(async () => {
      const user = await getAuthUserFromCookie();
      if (user) {
        const doc = await User.findById(user.userId)
          .select("registrationFeature emailVerified googleId")
          .lean();
        return NextResponse.json({
          user: {
            ...user,
            isSuperAdmin: isSuperAdmin(user.email),
            registrationFeature: doc?.registrationFeature ?? "default",
            emailVerified: doc ? isUserEmailVerified(doc) : false,
          },
        });
      }

      const cookieStore = await cookies();
      const token = cookieStore.get(getAuthCookieName())?.value;
      if (!token) return NextResponse.json({ user: null }, { status: 401 });

      try {
        const payload = verifyAuthToken(token);
        const doc = await User.findById(payload.userId).select("isBlocked").lean();
        if (doc && isUserBlocked(doc)) {
          return clearAuthCookie(
            NextResponse.json({ user: null, message: BLOCKED_LOGIN_MESSAGE }, { status: 403 }),
          );
        }
      } catch {
        // Invalid token — treat as logged out.
      }

      return clearAuthCookie(NextResponse.json({ user: null }, { status: 401 }));
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 503 });
  }
}
