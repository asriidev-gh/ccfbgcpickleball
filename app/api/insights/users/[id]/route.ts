import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { getUserDemoOpenPlays, getUserOpenPlays } from "@/lib/insights";
import { isSuperAdmin } from "@/lib/superadmin";
import { User } from "@/models/User";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id } = await params;
    const demoOnly =
      new URL(request.url).searchParams.get("demo") === "1" ||
      new URL(request.url).searchParams.get("demo") === "true";
    const openPlays = demoOnly ? await getUserDemoOpenPlays(id) : await getUserOpenPlays(id);
    if (!openPlays) return NextResponse.json({ message: "User not found." }, { status: 404 });

    return NextResponse.json(openPlays);

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load open plays." },
      { status: 400 },
    );
  }
}

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
    const updates: Record<string, boolean | string> = {};

    if (typeof body?.blocked === "boolean") {
      if (id === authUser.userId) {
        return NextResponse.json({ message: "You can't block your own account." }, { status: 400 });
      }
      updates.isBlocked = body.blocked;
    }
    if (body?.registrationFeature === "default" || body?.registrationFeature === "qr_id") {
      updates.registrationFeature = body.registrationFeature;
    }
    if (body?.userType === "default" || body?.userType === "ccf") {
      updates.userType = body.userType;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          message:
            "Provide blocked (boolean), registrationFeature (default | qr_id), and/or userType (default | ccf).",
        },
        { status: 400 },
      );
    }
    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true }).select(
      "name isBlocked registrationFeature userType",
    );

    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

    if (typeof body?.blocked === "boolean" && Object.keys(updates).length === 1) {
      return NextResponse.json({
        message: body.blocked ? "User blocked." : "User unblocked.",
        user: {
          id: user._id.toString(),
          name: user.name,
          isBlocked: user.isBlocked,
          registrationFeature: user.registrationFeature ?? "default",
          userType: user.userType ?? "default",
        },
      });
    }

    if (
      body?.registrationFeature === "default" ||
      body?.registrationFeature === "qr_id"
    ) {
      return NextResponse.json({
        message:
          body.registrationFeature === "qr_id"
            ? "Registration set to QR ID."
            : "Registration set to default.",
        user: {
          id: user._id.toString(),
          name: user.name,
          isBlocked: user.isBlocked,
          registrationFeature: user.registrationFeature ?? "default",
          userType: user.userType ?? "default",
        },
      });
    }

    if (body?.userType === "default" || body?.userType === "ccf") {
      return NextResponse.json({
        message:
          body.userType === "ccf" ? "User type set to CCF." : "User type set to default.",
        user: {
          id: user._id.toString(),
          name: user.name,
          isBlocked: user.isBlocked,
          registrationFeature: user.registrationFeature ?? "default",
          userType: user.userType ?? "default",
        },
      });
    }

    return NextResponse.json({
      message: "User updated.",
      user: {
        id: user._id.toString(),
        name: user.name,
        isBlocked: user.isBlocked,
        registrationFeature: user.registrationFeature ?? "default",
        userType: user.userType ?? "default",
      },
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update user." },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
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
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ message: "User not found." }, { status: 404 });

    return NextResponse.json({ message: "User deleted." });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete user." },
      { status: 400 },
    );
  }
}
