import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUserFromCookie } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  buildPlayerQrBrandingFromTitle,
  DEFAULT_QR_BRAND_NAME,
  MAX_PLAYER_QR_TITLE_LENGTH,
} from "@/lib/player-qr-branding";
import { buildPlayerQrDataUrlWithBranding } from "@/lib/player-qr";
import { isQrIdRegistrationEnabled } from "@/lib/registration-feature";
import { User } from "@/models/User";

const updatePlayerQrSettingsSchema = z.object({
  playerQrTitle: z
    .string()
    .trim()
    .max(
      MAX_PLAYER_QR_TITLE_LENGTH,
      `Title must be ${MAX_PLAYER_QR_TITLE_LENGTH} characters or less.`,
    ),
});

async function getAuthorizedQrUser(userId: string) {
  await connectToDatabase();
  const user = await User.findById(userId).select("registrationFeature playerQrTitle name").lean();
  if (!user) return null;
  if (!isQrIdRegistrationEnabled(user.registrationFeature)) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const user = await getAuthorizedQrUser(authUser.userId);
    if (!user) {
      return NextResponse.json(
        { message: "QR download settings are not enabled for your account." },
        { status: 403 },
      );
    }

    const playerQrTitle =
      typeof user.playerQrTitle === "string" ? user.playerQrTitle.trim() : "";

    const previewTitleParam = new URL(request.url).searchParams.get("previewTitle");
    const titleForPreview =
      previewTitleParam !== null ? previewTitleParam.trim().slice(0, MAX_PLAYER_QR_TITLE_LENGTH) : playerQrTitle;

    const branding = buildPlayerQrBrandingFromTitle(titleForPreview);
    const previewDataUrl = await buildPlayerQrDataUrlWithBranding("P-PREVIEW1234", {
      registrantFirstName: user.name.split(/\s+/)[0] || "Player",
      registrantLastName: user.name.split(/\s+/).slice(1).join(" ") || "",
      branding,
    });

    return NextResponse.json({
      playerQrTitle,
      defaultBrandName: DEFAULT_QR_BRAND_NAME,
      maxTitleLength: MAX_PLAYER_QR_TITLE_LENGTH,
      previewDataUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load QR settings." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const user = await getAuthorizedQrUser(authUser.userId);
    if (!user) {
      return NextResponse.json(
        { message: "QR download settings are not enabled for your account." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = updatePlayerQrSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    const playerQrTitle = parsed.data.playerQrTitle.trim();
    await User.findByIdAndUpdate(authUser.userId, { $set: { playerQrTitle } });

    const branding = buildPlayerQrBrandingFromTitle(playerQrTitle);
    const previewDataUrl = await buildPlayerQrDataUrlWithBranding("P-PREVIEW1234", {
      registrantFirstName: user.name.split(/\s+/)[0] || "Player",
      registrantLastName: user.name.split(/\s+/).slice(1).join(" ") || "",
      branding,
    });

    return NextResponse.json({
      message: "QR download settings saved.",
      playerQrTitle,
      previewDataUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save QR settings." },
      { status: 400 },
    );
  }
}
