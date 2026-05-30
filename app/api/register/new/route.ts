import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { uploadRegistrationPhoto } from "@/lib/cloudinary";
import {
  GENERATED_AVATAR_PUBLIC_ID,
  getGeneratedAvatarUrl,
} from "@/lib/player-avatar-url";
import { connectToDatabase } from "@/lib/db";
import {
  assertGameRegistrationAllowed,
  RegistrationLimitError,
} from "@/lib/game-registration-limit";
import { formatZodError } from "@/lib/format-zod-error";
import { capitalizeNameWords } from "@/lib/utils";
import {
  getRegistrationPhotoFromFormData,
  parseGenericPlayerPayloadFromFormData,
  parseNewPlayerPayloadFromFormData,
} from "@/lib/parse-registration-form";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import { genericPlayerSchema, newPlayerSchema, type NewPlayerInput } from "@/lib/validations";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    const formData = isMultipart ? await request.formData() : null;
    const jsonBody = !isMultipart ? await request.json() : null;

    const gameId = isMultipart
      ? String(formData?.get("gameId") ?? "").trim()
      : String(jsonBody?.gameId ?? "").trim();

    if (!gameId) {
      return NextResponse.json({ message: "Game ID is required." }, { status: 400 });
    }

    const formVariant = await resolveGameRegistrationFormVariant(gameId);
    if (!formVariant) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }

    const photoFile = formData ? getRegistrationPhotoFromFormData(formData) : null;

    let payload: ReturnType<typeof newPlayerSchema.parse> | ReturnType<typeof genericPlayerSchema.parse>;

    if (isMultipart && formData) {
      const parsed =
        formVariant === "generic"
          ? parseGenericPlayerPayloadFromFormData(formData)
          : parseNewPlayerPayloadFromFormData(formData, formVariant);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }
      payload = parsed.data;
    } else {
      const parsed =
        formVariant === "generic"
          ? genericPlayerSchema.safeParse(jsonBody)
          : newPlayerSchema.safeParse(jsonBody);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }
      payload = parsed.data;
    }

    await assertGameRegistrationAllowed(payload.gameId);

    const personalQrCode = `P-${nanoid(10)}`;
    let photoUrl = getGeneratedAvatarUrl(personalQrCode);
    let photoPublicId = GENERATED_AVATAR_PUBLIC_ID;

    if (photoFile) {
      const uploaded = await uploadRegistrationPhoto(photoFile, {
        gameId: payload.gameId,
        firstName: payload.firstName,
        lastName: payload.lastName,
      });
      photoUrl = uploaded.photoUrl;
      photoPublicId = uploaded.photoPublicId;
    }
    const playerFields = {
      firstName: capitalizeNameWords(payload.firstName),
      lastName: capitalizeNameWords(payload.lastName),
      mobileNumber: payload.mobileNumber,
      email: payload.email,
      personalQrCode,
      photoUrl,
      photoPublicId,
      lastAttendedAt: new Date(),
    };

    let player;
    if (formVariant === "generic") {
      player = await Player.create({
        ...playerFields,
        firstTimeSportsMinistry: false,
        isPartOfDgroup: false,
        attendedEvents: [],
        attendedEventsOther: "",
      });
    } else {
      const ccfPayload = payload as NewPlayerInput;
      player = await Player.create({
        ...playerFields,
        firstTimeSportsMinistry: ccfPayload.firstTimeSportsMinistry,
        isPartOfDgroup: ccfPayload.isPartOfDgroup,
        attendedEvents: ccfPayload.attendedEvents,
        attendedEventsOther: ccfPayload.attendedEventsOther ?? "",
      });
    }

    await QueueEntry.create({
      gameId: payload.gameId,
      playerId: player._id,
      status: "queued",
      queueType: "normal",
    });

    if (formVariant !== "generic") {
      const ccfPayload = payload as NewPlayerInput;
      if (ccfPayload.volunteerType) {
        await Volunteer.create({
          playerId: player._id,
          gameId: ccfPayload.gameId,
          volunteerType: ccfPayload.volunteerType,
          volunteerTypeOther: ccfPayload.volunteerTypeOther,
        });
      }
    }

    return NextResponse.json({
      player,
      message: `Registration complete. QR email queued to ${player.email}.`,
    });
  } catch (error) {
    if (error instanceof RegistrationLimitError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: formatZodError(error) },
      { status: 400 },
    );
  }
}
