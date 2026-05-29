import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { getAuthCookieName, signAuthToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    const user = await User.findOne({ email });
    if (!user) return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });

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
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to log in." },
      { status: 400 }
    );
  }
}
