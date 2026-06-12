import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { BLOCKED_LOGIN_MESSAGE, isUserBlocked } from "@/lib/user-block";
import { recordUserLogin } from "@/lib/user-auth-audit";
import { User } from "@/models/User";
import { getAuthCookieName, signAuthToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {

    return await runWithDatabase(async () => {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    const user = await User.findOne({ email });
    if (!user) return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });

    if (isUserBlocked(user)) {
      return NextResponse.json({ message: BLOCKED_LOGIN_MESSAGE }, { status: 403 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { message: "This account uses Google sign-in. Please continue with Google." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });

    await recordUserLogin(user._id.toString(), request);

    const token = signAuthToken({ userId: user._id.toString(), email: user.email, name: user.name });
    const response = NextResponse.json({ user: { id: user._id, email: user.email, name: user.name } });
    response.cookies.set(getAuthCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to log in." },
      { status: 400 }
    );
  }
}
