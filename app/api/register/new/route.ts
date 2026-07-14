import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { uploadRegistrationPhoto } from "@/lib/cloudinary";
import {
  GENERATED_AVATAR_PUBLIC_ID,
  getGeneratedAvatarUrl,
} from "@/lib/player-avatar-url";
import { runWithDatabase } from "@/lib/db";
import {
  assertGameRegistrationAllowed,
  RegistrationLimitError,
} from "@/lib/game-registration-limit";
import { formatZodError } from "@/lib/format-zod-error";
import { ALREADY_REGISTERED_MESSAGE } from "@/lib/registration-messages";
import { findPlayerAlreadyRegisteredForGame } from "@/lib/registration-duplicate";
import { capitalizeNameWords, formatPlayerDisplayName } from "@/lib/utils";
import { recordPlayerRegisteredNotification } from "@/lib/organizer-notifications";
import { createPrayerRequestFromRegistration } from "@/lib/owner-prayer-requests";
import {
  getRegistrationPhotoFromFormData,
  parseGenericPlayerPayloadFromFormData,
  parseNewPlayerPayloadFromFormData,
} from "@/lib/parse-registration-form";
import { isQrIdRegistrationEnabled } from "@/lib/registration-feature";
import { buildPlayerQrDataUrlWithBranding } from "@/lib/player-qr";
import { resolvePlayerQrRenderOptionsForGame } from "@/lib/player-qr-branding";
import { resolveGameRegistrationFeature } from "@/lib/resolve-game-registration-feature";
import { sendRegistrationWelcomeEmail } from "@/lib/registration-welcome-email";
import { buildWelcomeEmailPlayerUpdate } from "@/lib/welcome-email-status";
import { REGISTRATION_PHOTO_REQUIRED_MESSAGE } from "@/lib/registration-photo";
import { isRegistrationPhotoRequired } from "@/lib/registration-variant";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import {
  genericPlayerSchema,
  newPlayerSchema,
  type NewPlayerInput,
  type VolunteerNewPlayerInput,
  volunteerNewPlayerSchema,
} from "@/lib/validations";

function isVolunteerNewPlayerPayload(
  payload: NewPlayerInput | VolunteerNewPlayerInput | ReturnType<typeof genericPlayerSchema.parse>,
): payload is VolunteerNewPlayerInput {
  return "volunteerType" in payload && Boolean(payload.volunteerType);
}
import { Player } from "@/models/Player";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

export async function POST(request: Request) {
  try {


    return await runWithDatabase(async () => {

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

    let payload:
      | ReturnType<typeof newPlayerSchema.parse>
      | ReturnType<typeof volunteerNewPlayerSchema.parse>
      | ReturnType<typeof genericPlayerSchema.parse>;

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
      const isVolunteerJson =
        jsonBody?.volunteerType === "Pickleball" ||
        jsonBody?.volunteerType === "Running" ||
        jsonBody?.volunteerType === "Badminton" ||
        jsonBody?.volunteerType === "Other";
      const parsed =
        formVariant === "generic"
          ? genericPlayerSchema.safeParse(jsonBody)
          : isVolunteerJson
            ? volunteerNewPlayerSchema.safeParse(jsonBody)
            : newPlayerSchema.safeParse(jsonBody);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }
      payload = parsed.data;
    }

    if (isRegistrationPhotoRequired(formVariant) && !photoFile) {
      return NextResponse.json(
        { message: REGISTRATION_PHOTO_REQUIRED_MESSAGE },
        { status: 400 },
      );
    }

    await assertGameRegistrationAllowed(payload.gameId, { email: payload.email });

    const duplicatePlayer = await findPlayerAlreadyRegisteredForGame(payload.gameId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    });
    if (duplicatePlayer) {
      return NextResponse.json(
        {
          message: ALREADY_REGISTERED_MESSAGE,
          alreadyRegistered: true,
          player: { _id: duplicatePlayer._id },
        },
        { status: 409 },
      );
    }

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
      gender: payload.gender,
      birthdate: new Date(`${payload.birthdate}T00:00:00.000Z`),
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
    } else if (isVolunteerNewPlayerPayload(payload)) {
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
        firstTimeSportsMinistry: ccfPayload.firstTimeSportsMinistry ?? false,
        isPartOfDgroup: ccfPayload.isPartOfDgroup,
        wantsToJoinDgroup: ccfPayload.wantsToJoinDgroup ?? null,
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

    if (!isVolunteerNewPlayerPayload(payload) && formVariant !== "generic") {
      const ccfPayload = payload as NewPlayerInput;
      await createPrayerRequestFromRegistration(
        payload.gameId,
        String(player._id),
        ccfPayload.prayerRequest ?? "",
      );
    }

    await recordPlayerRegisteredNotification({
      gameId: payload.gameId,
      playerId: String(player._id),
      playerName: formatPlayerDisplayName(player.firstName, player.lastName),
    });

    if (formVariant !== "generic" && isVolunteerNewPlayerPayload(payload)) {
      await Volunteer.create({
        playerId: player._id,
        gameId: payload.gameId,
        volunteerType: payload.volunteerType,
        volunteerTypeOther: payload.volunteerTypeOther,
      });
    }

    const registrationFeature = await resolveGameRegistrationFeature(payload.gameId);
    const showPlayerQr =
      registrationFeature != null && isQrIdRegistrationEnabled(registrationFeature);
    const render = showPlayerQr ? await resolvePlayerQrRenderOptionsForGame(payload.gameId) : null;
    const personalQrCodeDataUrl =
      showPlayerQr && render
        ? await buildPlayerQrDataUrlWithBranding(player.personalQrCode, {
            registrantFirstName: player.firstName,
            registrantLastName: player.lastName,
            branding: render.branding,
            includeClubLogo: render.includeClubLogo,
            clubLogoUrl: render.clubLogoUrl,
          })
        : undefined;

    const game = await PickleGame.findOne({ gameId: payload.gameId }).select("title").lean();
    const emailResult = await sendRegistrationWelcomeEmail({
      to: player.email,
      firstName: player.firstName,
      lastName: player.lastName,
      personalQrCode: player.personalQrCode,
      gameId: payload.gameId,
      gameTitle: game?.title?.trim() || "Open play",
    });

    const emailTracking = buildWelcomeEmailPlayerUpdate(emailResult);
    await Player.findByIdAndUpdate(player._id, emailTracking);
    Object.assign(player, emailTracking);

    const emailSent = emailResult.sent;
    const message = emailSent
      ? showPlayerQr
        ? "Registration complete. Save your personal QR for next time — we also emailed your QR ID."
        : "Registration complete. Welcome email sent with your personal QR ID."
      : showPlayerQr
        ? "Registration complete. Save your personal QR for next time."
        : "Registration complete.";

    return NextResponse.json({
      player,
      showPlayerQr,
      personalQrCodeDataUrl,
      emailSent,
      message,
    });


    });} catch (error) {
    if (error instanceof RegistrationLimitError) {
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
      { status: 400 },
    );
  }
}
