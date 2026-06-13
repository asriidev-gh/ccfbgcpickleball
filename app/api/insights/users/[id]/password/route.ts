import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { isSuperAdmin } from "@/lib/superadmin";
import { User } from "@/models/User";

const MIN_PASSWORD_LENGTH = 6;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const password = String(body?.password ?? "");
    const confirmPassword = String(body?.confirmPassword ?? "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ message: "Passwords do not match." }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(id, { $set: { passwordHash } }, { returnDocument: 'after' }).select(
      "name email",
    );

    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

    return NextResponse.json({
      message: `Password updated for ${user.name}.`,
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update password." },
      { status: 400 },
    );
  }
}
