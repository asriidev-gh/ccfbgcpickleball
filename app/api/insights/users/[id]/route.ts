import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getUserOpenPlays } from "@/lib/insights";
import { isSuperAdmin } from "@/lib/superadmin";
import { User } from "@/models/User";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const openPlays = await getUserOpenPlays(id);
    if (!openPlays) return NextResponse.json({ message: "User not found." }, { status: 404 });

    return NextResponse.json(openPlays);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load open plays." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    if (id === authUser.userId) {
      return NextResponse.json({ message: "You can't block your own account." }, { status: 400 });
    }

    const body = await request.json();
    if (typeof body?.blocked !== "boolean") {
      return NextResponse.json({ message: "blocked (boolean) is required." }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isBlocked: body.blocked } },
      { new: true },
    ).select("name isBlocked");

    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

    return NextResponse.json({
      message: body.blocked ? "User blocked." : "User unblocked.",
      user: { id: user._id.toString(), name: user.name, isBlocked: user.isBlocked },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update user." },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    if (id === authUser.userId) {
      return NextResponse.json(
        { message: "You can't delete your own account." },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ message: "User not found." }, { status: 404 });

    return NextResponse.json({ message: "User deleted." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete user." },
      { status: 400 },
    );
  }
}
