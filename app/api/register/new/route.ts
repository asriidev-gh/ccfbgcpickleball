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
  parseNewPlayerPayloadFromFormData,
} from "@/lib/parse-registration-form";
import { newPlayerSchema } from "@/lib/validations";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const contentType = request.headers.get("content-type") ?? "";
    let payload: ReturnType<typeof newPlayerSchema.parse>;
    let photoFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const parsed = parseNewPlayerPayloadFromFormData(formData);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }
      payload = parsed.data;
      photoFile = getRegistrationPhotoFromFormData(formData);
    } else {
      const body = await request.json();
      const parsed = newPlayerSchema.safeParse(body);
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
    const player = await Player.create({
      firstName: capitalizeNameWords(payload.firstName),
      lastName: capitalizeNameWords(payload.lastName),
      mobileNumber: payload.mobileNumber,
      email: payload.email,
      personalQrCode,
      firstTimeSportsMinistry: payload.firstTimeSportsMinistry,
      isPartOfDgroup: payload.isPartOfDgroup,
      attendedEvents: payload.attendedEvents,
      attendedEventsOther: payload.attendedEventsOther,
      photoUrl,
      photoPublicId,
      lastAttendedAt: new Date(),
    });

    await QueueEntry.create({
      gameId: payload.gameId,
      playerId: player._id,
      status: "queued",
      queueType: "normal",
    });

    if (payload.volunteerType) {
      await Volunteer.create({
        playerId: player._id,
        gameId: payload.gameId,
        volunteerType: payload.volunteerType,
        volunteerTypeOther: payload.volunteerTypeOther,
      });
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
