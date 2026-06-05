import { NextResponse } from "next/server";

import { uploadProfilePhoto } from "@/lib/cloudinary";
import { connectToDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  getProfilePhotoFromFormData,
  parseProfilePayloadFromFormData,
} from "@/lib/parse-profile-form";
import {
  assertPlayerRegisteredForGame,
  isValidPlayerId,
  loadPlayerProfileForGame,
  PlayerProfileAccessError,
  serializePlayerProfile,
} from "@/lib/player-profile";
import { capitalizeNameWords } from "@/lib/utils";
import {
  profileBaseSchema,
  profileCcfFieldsSchema,
  type ProfileCcfFieldsInput,
} from "@/lib/validations";
import { Player } from "@/models/Player";

function readPlayerId(request: Request, formData: FormData | null) {
  if (formData) {
    const value = formData.get("playerId");
    return typeof value === "string" ? value.trim() : "";
  }

  const url = new URL(request.url);
  return url.searchParams.get("playerId")?.trim() ?? "";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const playerId = readPlayerId(request, null);
    if (!playerId) {
      return NextResponse.json({ message: "Player session is required." }, { status: 400 });
    }

    const { profile } = await loadPlayerProfileForGame(gameId, playerId);
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load profile." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    const formData = isMultipart ? await request.formData() : null;
    const jsonBody = !isMultipart ? await request.json() : null;

    const playerId = isMultipart && formData
      ? readPlayerId(request, formData)
      : String(jsonBody?.playerId ?? "").trim();

    if (!playerId || !isValidPlayerId(playerId)) {
      return NextResponse.json({ message: "Player session is required." }, { status: 400 });
    }

    await connectToDatabase();
    const { showCcfQuestionnaire } = await loadPlayerProfileForGame(gameId, playerId);
    await assertPlayerRegisteredForGame(gameId, playerId);

    type ProfilePayload = ReturnType<typeof profileBaseSchema.parse> &
      Partial<ProfileCcfFieldsInput>;

    let payload: ProfilePayload;

    if (isMultipart && formData) {
      const parsed = parseProfilePayloadFromFormData(formData, showCcfQuestionnaire);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }
      payload = parsed.data;
    } else {
      const baseParsed = profileBaseSchema.safeParse(jsonBody);
      if (!baseParsed.success) {
        return NextResponse.json({ message: formatZodError(baseParsed.error) }, { status: 400 });
      }
      payload = baseParsed.data;
      if (showCcfQuestionnaire) {
        const ccfParsed = profileCcfFieldsSchema.safeParse(jsonBody);
        if (!ccfParsed.success) {
          return NextResponse.json({ message: formatZodError(ccfParsed.error) }, { status: 400 });
        }
        payload = { ...payload, ...ccfParsed.data };
      }
    }

    const photoFile = formData ? getProfilePhotoFromFormData(formData) : null;
    let photoUrl: string | undefined;
    let photoPublicId: string | undefined;

    if (photoFile) {
      const uploaded = await uploadProfilePhoto(photoFile, {
        gameId,
        playerId,
        firstName: payload.firstName,
        lastName: payload.lastName,
      });
      photoUrl = uploaded.photoUrl;
      photoPublicId = uploaded.photoPublicId;
    }

    const playerFields: Record<string, unknown> = {
      firstName: capitalizeNameWords(payload.firstName),
      lastName: capitalizeNameWords(payload.lastName),
      mobileNumber: payload.mobileNumber,
      gender: payload.gender || "",
      biography: payload.biography,
      pickleballLevel: payload.pickleballLevel || "",
      ...(showCcfQuestionnaire && "attendedEvents" in payload && payload.attendedEvents
        ? {
            isPartOfDgroup: payload.isPartOfDgroup ?? false,
            wantsToJoinDgroup: payload.wantsToJoinDgroup ?? null,
            attendedEvents: payload.attendedEvents,
            attendedEventsOther: payload.attendedEventsOther ?? "",
          }
        : {}),
      ...(photoUrl && photoPublicId ? { photoUrl, photoPublicId } : {}),
    };

    if (payload.birthdate) {
      playerFields.birthdate = new Date(`${payload.birthdate}T12:00:00.000Z`);
    }

    const player = await Player.findById(playerId);
    if (!player) {
      return NextResponse.json({ message: "Player profile not found." }, { status: 404 });
    }

    Object.assign(player, playerFields);
    if (!payload.birthdate) player.set("birthdate", undefined);
    await player.save();

    return NextResponse.json({
      message: "Profile updated.",
      profile: serializePlayerProfile(player, showCcfQuestionnaire),
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update profile." },
      { status: 400 },
    );
  }
}
