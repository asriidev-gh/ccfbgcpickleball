import { NextResponse } from "next/server";

import { createPrayerRequestFromRegistration } from "@/lib/owner-prayer-requests";
import { runWithDatabase } from "@/lib/db";
import {
  assertGameRegistrationAllowed,
  RegistrationLimitError,
} from "@/lib/game-registration-limit";
import { formatZodError } from "@/lib/format-zod-error";
import {
  recordCheckinAttemptNotification,
  recordPlayerRegisteredNotification,
} from "@/lib/organizer-notifications";
import { QR_UPLOAD_REGISTRATION_SOURCE } from "@/lib/registration-feature";
import {
  parseQrUploadCcfMode,
  resolveQrUploadCcfQuestionnaireMode,
} from "@/lib/qr-upload-ccf-questionnaire-shared";
import { formatPlayerDisplayName } from "@/lib/utils";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import {
  existingPlayerSchema,
  genericExistingPlayerSchema,
  type ExistingPlayerInput,
  qrUploadFullExistingPlayerSchema,
  qrUploadJoinDgroupExistingPlayerSchema,
  type QrUploadJoinDgroupExistingPlayerInput,
  qrUploadSkipExistingPlayerSchema,
  volunteerExistingPlayerSchema,
  type VolunteerExistingPlayerInput,
} from "@/lib/validations";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

export async function POST(request: Request) {
  let gameIdFromRequest: string | null = null;
  try {
    return await runWithDatabase(async () => {
    const body = await request.json();
    gameIdFromRequest = typeof body?.gameId === "string" ? body.gameId : null;
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
    const qrUploadCcfMode =
      isQrUploadCheckIn && !isGenericForm
        ? parseQrUploadCcfMode(body?.qrUploadCcfMode) ?? "none"
        : null;

    const parsed = isVolunteer
      ? volunteerExistingPlayerSchema.safeParse(body)
      : isQrUploadCheckIn && !isGenericForm
        ? qrUploadCcfMode === "full"
          ? qrUploadFullExistingPlayerSchema.safeParse(body)
          : qrUploadCcfMode === "join_dgroup_only"
            ? qrUploadJoinDgroupExistingPlayerSchema.safeParse(body)
            : qrUploadSkipExistingPlayerSchema.safeParse(body)
        : isGenericForm
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

    if (isQrUploadCheckIn && !isGenericForm) {
      const expectedMode = resolveQrUploadCcfQuestionnaireMode(player);
      if (qrUploadCcfMode !== expectedMode) {
        return NextResponse.json(
          { message: "Please scan your QR again and complete the registration questions." },
          { status: 400 },
        );
      }
    }

    await assertGameRegistrationAllowed(payload.gameId, {
      email: player.email,
      playerId: String(player._id),
    });

    const shouldUpdateFullCcfProfile =
      !isVolunteer &&
      !isGenericForm &&
      (!isQrUploadCheckIn || qrUploadCcfMode === "full");
    const shouldUpdateJoinDgroupOnly =
      !isVolunteer && !isGenericForm && isQrUploadCheckIn && qrUploadCcfMode === "join_dgroup_only";

    if (shouldUpdateFullCcfProfile) {
      const playerPayload = payload as ExistingPlayerInput;
      player.isPartOfDgroup = playerPayload.isPartOfDgroup;
      player.wantsToJoinDgroup = playerPayload.wantsToJoinDgroup ?? null;
      player.attendedEvents = playerPayload.attendedEvents;
      player.attendedEventsOther = playerPayload.attendedEventsOther;
    } else if (shouldUpdateJoinDgroupOnly) {
      const playerPayload = payload as QrUploadJoinDgroupExistingPlayerInput;
      player.wantsToJoinDgroup = playerPayload.wantsToJoinDgroup;
    }
    player.lastAttendedAt = new Date();
    await player.save();

    await QueueEntry.create({
      gameId: payload.gameId,
      playerId: player._id,
      status: "queued",
      queueType: "normal",
    });

    if (shouldUpdateFullCcfProfile) {
      const playerPayload = payload as ExistingPlayerInput;
      await createPrayerRequestFromRegistration(
        payload.gameId,
        String(player._id),
        playerPayload.prayerRequest ?? "",
      );
    }

    await recordPlayerRegisteredNotification({
      gameId: payload.gameId,
      playerId: String(player._id),
      playerName: formatPlayerDisplayName(player.firstName, player.lastName),
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
        { upsert: true, returnDocument: 'after' }
      );
    }

    return NextResponse.json({ player, message: "Welcome back! Added to queue." });
    });
  } catch (error) {
    if (error instanceof RegistrationLimitError) {
      const gameId = gameIdFromRequest;
      const playerId = error.playerId;
      if (error.checkedOut && gameId && playerId) {
        await runWithDatabase(async () => {
          const checkedOutPlayer = await Player.findById(playerId).select("firstName lastName");
          if (checkedOutPlayer) {
            await recordCheckinAttemptNotification({
              gameId,
              playerId,
              playerName: formatPlayerDisplayName(
                checkedOutPlayer.firstName,
                checkedOutPlayer.lastName,
              ),
            });
          }
        });
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
