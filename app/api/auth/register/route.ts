import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { REGISTRATION_FEATURE_QR_ID } from "@/lib/registration-feature";
import { USER_TYPE_DEFAULT } from "@/lib/registration-variant";
import { getRegistrationDevice } from "@/lib/user-auth-audit";
import { User } from "@/models/User";
import { getAuthCookieName, signAuthToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {

    return await runWithDatabase(async () => {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!name || !email || password.length < 6) {
      return NextResponse.json(
        { message: "Name, email, and password (minimum 6 characters) are required." },
        { status: 400 }
      );
    }

    const exists = await User.findOne({ email });
    if (exists) return NextResponse.json({ message: "Email is already registered." }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const device = getRegistrationDevice(request);
    const now = new Date();
    const user = await User.create({
      name,
      email,
      passwordHash,
      userType: USER_TYPE_DEFAULT,
      registrationFeature: REGISTRATION_FEATURE_QR_ID,
      registeredDevice: device,
      lastLoginAt: now,
      lastLoginDevice: device,
    });
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
      { message: error instanceof Error ? error.message : "Failed to register." },
      { status: 400 }
    );
  }
}
