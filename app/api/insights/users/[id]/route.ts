import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { getUserDemoOpenPlays, getUserOpenPlays, getUserQuickGameOpenPlays } from "@/lib/insights";
import { isSuperAdmin } from "@/lib/superadmin";
import { isUserEmailVerified } from "@/lib/user-email-verification";
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
    const quickOnly =
      new URL(request.url).searchParams.get("quick") === "1" ||
      new URL(request.url).searchParams.get("quick") === "true";

    const openPlays = quickOnly
      ? await getUserQuickGameOpenPlays(id)
      : demoOnly
        ? await getUserDemoOpenPlays(id)
        : await getUserOpenPlays(id);
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
    const setUpdates: Record<string, boolean | string> = {};
    const unsetUpdates: Record<string, 1> = {};

    if (typeof body?.blocked === "boolean") {
      if (id === authUser.userId) {
        return NextResponse.json({ message: "You can't block your own account." }, { status: 400 });
      }
      setUpdates.isBlocked = body.blocked;
    }
    if (body?.registrationFeature === "default" || body?.registrationFeature === "qr_id") {
      setUpdates.registrationFeature = body.registrationFeature;
    }
    if (body?.userType === "default" || body?.userType === "ccf") {
      setUpdates.userType = body.userType;
    }
    if (typeof body?.emailVerified === "boolean") {
      setUpdates.emailVerified = body.emailVerified;
      if (body.emailVerified) {
        unsetUpdates.emailVerificationTokenHash = 1;
        unsetUpdates.emailVerificationExpiresAt = 1;
      }
    }

    if (Object.keys(setUpdates).length === 0 && Object.keys(unsetUpdates).length === 0) {
      return NextResponse.json(
        {
          message:
            "Provide blocked (boolean), emailVerified (boolean), registrationFeature (default | qr_id), and/or userType (default | ccf).",
        },
        { status: 400 },
      );
    }

    const updateQuery: { $set?: Record<string, boolean | string>; $unset?: Record<string, 1> } = {};
    if (Object.keys(setUpdates).length > 0) updateQuery.$set = setUpdates;
    if (Object.keys(unsetUpdates).length > 0) updateQuery.$unset = unsetUpdates;

    const user = await User.findByIdAndUpdate(id, updateQuery, { returnDocument: "after" }).select(
      "name isBlocked registrationFeature userType emailVerified googleId",
    );

    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

    const userPayload = {
      id: user._id.toString(),
      name: user.name,
      isBlocked: user.isBlocked,
      registrationFeature: user.registrationFeature ?? "default",
      userType: user.userType ?? "default",
      emailVerified: isUserEmailVerified({
        emailVerified: user.emailVerified,
        googleId: user.googleId,
      }),
    };

    if (typeof body?.blocked === "boolean" && Object.keys(setUpdates).length === 1) {
      return NextResponse.json({
        message: body.blocked ? "User blocked." : "User unblocked.",
        user: userPayload,
      });
    }

    if (typeof body?.emailVerified === "boolean" && Object.keys(setUpdates).length === 1) {
      return NextResponse.json({
        message: body.emailVerified ? "User marked as verified." : "User marked as unverified.",
        user: userPayload,
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
        user: userPayload,
      });
    }

    if (body?.userType === "default" || body?.userType === "ccf") {
      return NextResponse.json({
        message:
          body.userType === "ccf" ? "User type set to CCF." : "User type set to default.",
        user: userPayload,
      });
    }

    return NextResponse.json({
      message: "User updated.",
      user: userPayload,
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
