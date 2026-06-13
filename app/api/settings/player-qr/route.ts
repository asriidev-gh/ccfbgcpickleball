import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { buildPlayerQrDataUrlWithBranding } from "@/lib/player-qr";
import {
  DEFAULT_QR_BRAND_NAME,
  MAX_PLAYER_QR_TITLE_LENGTH,
  resolvePlayerQrRenderOptionsForPreview,
} from "@/lib/player-qr-branding";
import { User } from "@/models/User";

const QR_SETTINGS_SELECT =
  "playerQrTitle playerQrIncludeClubLogo clubLogoUrl name";

const updatePlayerQrSettingsSchema = z.object({
  playerQrTitle: z
    .string()
    .trim()
    .max(
      MAX_PLAYER_QR_TITLE_LENGTH,
      `Title must be ${MAX_PLAYER_QR_TITLE_LENGTH} characters or less.`,
    ),
  playerQrIncludeClubLogo: z.boolean(),
});

function parsePreviewBoolean(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

async function getQrSettingsUser(userId: string) {
  const user = await User.findById(userId).select(QR_SETTINGS_SELECT).lean();
  return user ?? null;
}

function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Player",
    lastName: parts.slice(1).join(" "),
  };
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
      const clubLogoUrl =
        typeof user.clubLogoUrl === "string" ? user.clubLogoUrl.trim() : "";
      const hasClubLogo = Boolean(clubLogoUrl);

      const url = new URL(request.url);
      const previewTitleParam = url.searchParams.get("previewTitle");
      const titleForPreview =
        previewTitleParam !== null
          ? previewTitleParam.trim().slice(0, MAX_PLAYER_QR_TITLE_LENGTH)
          : playerQrTitle;

      const previewIncludeClubLogoParam = parsePreviewBoolean(
        url.searchParams.get("previewIncludeClubLogo"),
      );
      const includeClubLogoForPreview =
        previewIncludeClubLogoParam ??
        (typeof user.playerQrIncludeClubLogo === "boolean"
          ? user.playerQrIncludeClubLogo
          : hasClubLogo);

      const render = resolvePlayerQrRenderOptionsForPreview({
        playerQrTitle: titleForPreview,
        playerQrIncludeClubLogo: includeClubLogoForPreview,
        clubLogoUrl,
      });
      const { firstName, lastName } = splitDisplayName(
        typeof user.name === "string" ? user.name : authUser.name,
      );
      const previewDataUrl = await buildPlayerQrDataUrlWithBranding("P-PREVIEW1234", {
        registrantFirstName: firstName,
        registrantLastName: lastName,
        branding: render.branding,
        includeClubLogo: render.includeClubLogo,
        clubLogoUrl: render.clubLogoUrl,
      });

      const playerQrIncludeClubLogo = render.includeClubLogo;

      return NextResponse.json({
        playerQrTitle,
        playerQrIncludeClubLogo,
        hasClubLogo,
        defaultBrandName: DEFAULT_QR_BRAND_NAME,
        maxTitleLength: MAX_PLAYER_QR_TITLE_LENGTH,
        previewDataUrl,
      });
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

      const clubLogoUrl =
        typeof user.clubLogoUrl === "string" ? user.clubLogoUrl.trim() : "";
      const hasClubLogo = Boolean(clubLogoUrl);
      const playerQrTitle = parsed.data.playerQrTitle.trim();
      const playerQrIncludeClubLogo = hasClubLogo ? parsed.data.playerQrIncludeClubLogo : false;

      await User.findByIdAndUpdate(authUser.userId, {
        $set: {
          playerQrTitle,
          playerQrIncludeClubLogo,
        },
      });

      const render = resolvePlayerQrRenderOptionsForPreview({
        playerQrTitle,
        playerQrIncludeClubLogo,
        clubLogoUrl,
      });
      const { firstName, lastName } = splitDisplayName(
        typeof user.name === "string" ? user.name : authUser.name,
      );
      const previewDataUrl = await buildPlayerQrDataUrlWithBranding("P-PREVIEW1234", {
        registrantFirstName: firstName,
        registrantLastName: lastName,
        branding: render.branding,
        includeClubLogo: render.includeClubLogo,
        clubLogoUrl: render.clubLogoUrl,
      });

      return NextResponse.json({
        message: "QR download settings saved.",
        playerQrTitle,
        playerQrIncludeClubLogo: render.includeClubLogo,
        hasClubLogo,
        previewDataUrl,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save QR settings." },
      { status: 400 },
    );
  }
}
