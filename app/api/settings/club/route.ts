import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import {
  deleteRegistrationPhotos,
  isCloudinaryConfigured,
  uploadClubLogo,
} from "@/lib/cloudinary";
import type { ClubSettings } from "@/lib/club-settings-shared";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { clubSettingsSchema } from "@/lib/validations";
import { User } from "@/models/User";

const CLUB_SETTINGS_SELECT =
  "name clubName clubTagline clubAdditionalInfo clubMissionVision clubLogoUrl clubLogoPublicId clubFacebookUrl clubInstagramUrl clubAddress clubGoogleMapEmbedUrl";

function resolveDefaultClubName(user: { name?: string }, authName: string) {
  const name = typeof user.name === "string" ? user.name.trim() : "";
  return name || authName.trim();
}

function normalizeClubSettings(user: {
  clubName?: string;
  clubTagline?: string;
  clubAdditionalInfo?: string;
  clubMissionVision?: string;
  clubLogoUrl?: string;
  clubFacebookUrl?: string;
  clubInstagramUrl?: string;
  clubAddress?: string;
  clubGoogleMapEmbedUrl?: string;
}): ClubSettings {
  return {
    clubName: typeof user.clubName === "string" ? user.clubName.trim() : "",
    clubTagline: typeof user.clubTagline === "string" ? user.clubTagline.trim() : "",
    clubAdditionalInfo:
      typeof user.clubAdditionalInfo === "string" ? user.clubAdditionalInfo.trim() : "",
    clubMissionVision:
      typeof user.clubMissionVision === "string" ? user.clubMissionVision.trim() : "",
    clubLogoUrl: typeof user.clubLogoUrl === "string" ? user.clubLogoUrl.trim() : "",
    clubFacebookUrl:
      typeof user.clubFacebookUrl === "string" ? user.clubFacebookUrl.trim() : "",
    clubInstagramUrl:
      typeof user.clubInstagramUrl === "string" ? user.clubInstagramUrl.trim() : "",
    clubAddress: typeof user.clubAddress === "string" ? user.clubAddress.trim() : "",
    clubGoogleMapEmbedUrl:
      typeof user.clubGoogleMapEmbedUrl === "string" ? user.clubGoogleMapEmbedUrl.trim() : "",
  };
}

export async function GET() {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const user = await User.findById(authUser.userId).select(CLUB_SETTINGS_SELECT).lean();
      if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
      }

      return NextResponse.json({
        ...normalizeClubSettings(user),
        defaultClubName: resolveDefaultClubName(user, authUser.name),
        logoUploadConfigured: isCloudinaryConfigured(),
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load club settings." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const user = await User.findById(authUser.userId).select(CLUB_SETTINGS_SELECT).lean();
      if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
      }

      const formData = await request.formData();
      const parsed = clubSettingsSchema.safeParse({
        clubName: formData.get("clubName") ?? "",
        clubTagline: formData.get("clubTagline") ?? "",
        clubAdditionalInfo: formData.get("clubAdditionalInfo") ?? "",
        clubMissionVision: formData.get("clubMissionVision") ?? "",
        clubFacebookUrl: formData.get("clubFacebookUrl") ?? "",
        clubInstagramUrl: formData.get("clubInstagramUrl") ?? "",
        clubAddress: formData.get("clubAddress") ?? "",
        clubGoogleMapEmbedUrl: formData.get("clubGoogleMapEmbedUrl") ?? "",
      });
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const removeLogo = formData.get("removeLogo") === "true";
      const logoEntry = formData.get("logo");
      const logoFile = logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;

      let clubLogoUrl =
        typeof user.clubLogoUrl === "string" ? user.clubLogoUrl.trim() : "";
      let clubLogoPublicId =
        typeof user.clubLogoPublicId === "string" ? user.clubLogoPublicId.trim() : "";

      if (removeLogo) {
        if (clubLogoPublicId) {
          await deleteRegistrationPhotos([clubLogoPublicId]);
        }
        clubLogoUrl = "";
        clubLogoPublicId = "";
      } else if (logoFile) {
        const uploaded = await uploadClubLogo(logoFile, { userId: authUser.userId });
        if (clubLogoPublicId) {
          await deleteRegistrationPhotos([clubLogoPublicId]);
        }
        clubLogoUrl = uploaded.photoUrl;
        clubLogoPublicId = uploaded.photoPublicId;
      }

      await User.findByIdAndUpdate(authUser.userId, {
        $set: {
          ...parsed.data,
          clubLogoUrl,
          clubLogoPublicId,
        },
      });

      return NextResponse.json({
        message: "Club settings saved.",
        ...parsed.data,
        clubLogoUrl,
        defaultClubName: resolveDefaultClubName(user, authUser.name),
        logoUploadConfigured: isCloudinaryConfigured(),
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to save club settings." },
      { status: 400 },
    );
  }
}
