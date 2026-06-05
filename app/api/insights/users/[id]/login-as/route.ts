import { NextResponse } from "next/server";

import { getAuthUserFromCookie, signImpersonationToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { isSuperAdminUserId } from "@/lib/superadmin";
import { BLOCKED_LOGIN_MESSAGE, isUserBlocked } from "@/lib/user-block";
import { User } from "@/models/User";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!(await isSuperAdminUserId(authUser.userId))) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();
    const user = await User.findById(id).select("name isBlocked").lean();
    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });
    if (isUserBlocked(user)) {
      return NextResponse.json({ message: BLOCKED_LOGIN_MESSAGE }, { status: 403 });
    }

    const token = signImpersonationToken(id, authUser.userId);

    return NextResponse.json({
      message: `Opening session for ${user.name}.`,
      token,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to sign in as user." },
      { status: 400 },
    );
  }
}
