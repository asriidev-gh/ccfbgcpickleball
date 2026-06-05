import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { formatZodError } from "@/lib/format-zod-error";
import {
  getOwnerPlayerProfile,
  parseOwnerProfileUpdate,
  updateOwnerPlayerProfile,
} from "@/lib/owner-player-profile";
import { getRegistrationFormVariant } from "@/lib/registration-variant";
import { User } from "@/models/User";

async function organizerShowsCcf(ownerId: string) {
  const owner = await User.findById(ownerId).select("userType").lean();
  const userType =
    owner && typeof owner === "object" && typeof owner.userType === "string"
      ? owner.userType
      : undefined;
  return getRegistrationFormVariant(userType) === "ccf";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const profile = await getOwnerPlayerProfile(authUser.userId, id);
    if (!profile) return NextResponse.json({ message: "Player not found." }, { status: 404 });

    return NextResponse.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load player profile.";
    const status = message.includes("not registered") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const showCcfQuestionnaire = await organizerShowsCcf(authUser.userId);

    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    const formData = isMultipart ? await request.formData() : null;
    const jsonBody = !isMultipart ? await request.json() : null;

    const parsed = await parseOwnerProfileUpdate(
      authUser.userId,
      jsonBody,
      formData,
      showCcfQuestionnaire,
    );

    if ("error" in parsed) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    const profile = await updateOwnerPlayerProfile(
      authUser.userId,
      id,
      parsed.payload,
      parsed.photoFile,
      showCcfQuestionnaire,
    );

    return NextResponse.json({
      message: "Player profile updated.",
      profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update player profile.";
    const status = message.includes("not registered") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
