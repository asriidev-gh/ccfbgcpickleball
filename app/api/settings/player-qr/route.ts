import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  buildPlayerQrBrandingFromTitle,
  DEFAULT_QR_BRAND_NAME,
  MAX_PLAYER_QR_TITLE_LENGTH,
} from "@/lib/player-qr-branding";
import { buildPlayerQrDataUrlWithBranding } from "@/lib/player-qr";
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

async function getQrSettingsUser(userId: string) {
  const user = await User.findById(userId).select("playerQrTitle name").lean();
  return user ?? null;
}

export async function GET(request: Request) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const user = await getQrSettingsUser(authUser.userId);
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
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

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load QR settings." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const user = await getQrSettingsUser(authUser.userId);
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
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

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save QR settings." },
      { status: 400 },
    );
  }
}
