import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import {
  assertGameRegistrationAllowed,
  RegistrationLimitError,
} from "@/lib/game-registration-limit";
import { formatZodError } from "@/lib/format-zod-error";
import { recordCheckinAttemptNotification } from "@/lib/organizer-notifications";
import { QR_UPLOAD_REGISTRATION_SOURCE } from "@/lib/registration-feature";
import { formatPlayerDisplayName } from "@/lib/utils";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import {
  existingPlayerSchema,
  genericExistingPlayerSchema,
  type ExistingPlayerInput,
  volunteerExistingPlayerSchema,
  type VolunteerExistingPlayerInput,
} from "@/lib/validations";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

export async function POST(request: Request) {
  let body: Record<string, unknown> | null = null;
  try {
    await connectToDatabase();
    body = await request.json();
    const isVolunteer =
      body?.volunteerType === "Pickleball" ||
      body?.volunteerType === "Running" ||
      body?.volunteerType === "Badminton" ||
      body?.volunteerType === "Other";
    const formVariant = await resolveGameRegistrationFormVariant(
      typeof body?.gameId === "string" ? body.gameId : "",
    );
    const isGenericForm = formVariant === "generic";
    const isQrUploadCheckIn = body?.registrationSource === QR_UPLOAD_REGISTRATION_SOURCE;

    const parsed = isVolunteer
      ? volunteerExistingPlayerSchema.safeParse(body)
      : isGenericForm || isQrUploadCheckIn
        ? genericExistingPlayerSchema.safeParse(body)
        : existingPlayerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }
    const payload = parsed.data;

    const player = await Player.findOne({ personalQrCode: payload.personalQrCode });
    if (!player) {
      return NextResponse.json({ message: "Player QR not found." }, { status: 404 });
    }

    await assertGameRegistrationAllowed(payload.gameId, {
      email: player.email,
      playerId: String(player._id),
    });

    if (!isVolunteer && !isGenericForm && !isQrUploadCheckIn) {
      const playerPayload = payload as ExistingPlayerInput;
      player.isPartOfDgroup = playerPayload.isPartOfDgroup;
      player.wantsToJoinDgroup = playerPayload.wantsToJoinDgroup ?? null;
      player.attendedEvents = playerPayload.attendedEvents;
      player.attendedEventsOther = playerPayload.attendedEventsOther;
    }
    player.lastAttendedAt = new Date();
    await player.save();

    await QueueEntry.create({
      gameId: payload.gameId,
      playerId: player._id,
      status: "queued",
      queueType: "normal",
    });

    if (isVolunteer) {
      const volunteerPayload = payload as VolunteerExistingPlayerInput;
      await Volunteer.findOneAndUpdate(
        { playerId: player._id, gameId: payload.gameId },
        {
          playerId: player._id,
          gameId: payload.gameId,
          volunteerType: volunteerPayload.volunteerType,
          volunteerTypeOther: volunteerPayload.volunteerTypeOther,
        },
        { upsert: true, new: true }
      );
    }

    return NextResponse.json({ player, message: "Welcome back! Added to queue." });
  } catch (error) {
    if (error instanceof RegistrationLimitError) {
      if (error.checkedOut && typeof body?.gameId === "string" && error.playerId) {
        const checkedOutPlayer = await Player.findById(error.playerId).select("firstName lastName");
        if (checkedOutPlayer) {
          await recordCheckinAttemptNotification({
            gameId: body.gameId,
            playerId: error.playerId,
            playerName: formatPlayerDisplayName(
              checkedOutPlayer.firstName,
              checkedOutPlayer.lastName,
            ),
          });
        }
      }

      return NextResponse.json(
        {
          message: error.message,
          alreadyRegistered: error.alreadyRegistered ?? false,
          checkedOut: error.checkedOut ?? false,
          ...(error.playerId ? { player: { _id: error.playerId } } : {}),
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { message: formatZodError(error) },
      { status: 400 }
    );
  }
}
