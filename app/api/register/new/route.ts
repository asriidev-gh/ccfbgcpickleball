import { NextResponse, after } from "next/server";
import { nanoid } from "nanoid";

import { uploadRegistrationPhoto } from "@/lib/cloudinary";
import {
  GENERATED_AVATAR_PUBLIC_ID,
  getGeneratedAvatarUrl,
} from "@/lib/player-avatar-url";
import { connectToDatabase, runWithDatabase } from "@/lib/db";
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
import {
  isQrIdRegistrationEnabled,
  normalizeRegistrationFeature,
  REGISTRATION_FEATURE_DEFAULT,
} from "@/lib/registration-feature";
import { sendRegistrationWelcomeEmail } from "@/lib/registration-welcome-email";
import { buildWelcomeEmailPlayerUpdate } from "@/lib/welcome-email-status";
import { REGISTRATION_PHOTO_REQUIRED_MESSAGE } from "@/lib/registration-photo";
import {
  getRegistrationFormVariant,
  isRegistrationPhotoRequired,
  type RegistrationFormVariant,
} from "@/lib/registration-variant";
import {
  genericPlayerSchema,
  newPlayerSchema,
  type NewPlayerInput,
  type VolunteerNewPlayerInput,
  volunteerNewPlayerSchema,
} from "@/lib/validations";
import { Player } from "@/models/Player";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";
import { Volunteer } from "@/models/Volunteer";

function isVolunteerNewPlayerPayload(
  payload: NewPlayerInput | VolunteerNewPlayerInput | ReturnType<typeof genericPlayerSchema.parse>,
): payload is VolunteerNewPlayerInput {
  return "volunteerType" in payload && Boolean(payload.volunteerType);
}

type RegistrationGameContext = {
  formVariant: RegistrationFormVariant;
  showPlayerQr: boolean;
  gameTitle: string;
};

async function loadRegistrationGameContext(
  gameId: string,
): Promise<RegistrationGameContext | null> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("ownerId title").lean<{
    ownerId?: unknown;
    title?: string;
  } | null>();
  if (!game) return null;

  const owner = game.ownerId
    ? await User.findById(game.ownerId)
        .select("userType registrationFeature")
        .lean<{ userType?: string; registrationFeature?: string } | null>()
    : null;

  const formVariant = getRegistrationFormVariant(
    owner && typeof owner.userType === "string" ? owner.userType : undefined,
  );
  const registrationFeature = owner
    ? normalizeRegistrationFeature(
        typeof owner.registrationFeature === "string" ? owner.registrationFeature : undefined,
      )
    : REGISTRATION_FEATURE_DEFAULT;

  return {
    formVariant,
    showPlayerQr: isQrIdRegistrationEnabled(registrationFeature),
    gameTitle: game.title?.trim() || "Open play",
  };
}

function queueBackgroundRegistrationWork(input: {
  gameId: string;
  gameTitle: string;
  playerId: string;
  firstName: string;
  lastName: string;
  email: string;
  personalQrCode: string;
  prayerRequest?: string;
  volunteerType?: string;
  volunteerTypeOther?: string;
}) {
  after(() => {
    void (async () => {
      try {
        if (input.prayerRequest?.trim()) {
          await createPrayerRequestFromRegistration(
            input.gameId,
            input.playerId,
            input.prayerRequest,
          );
        }

        if (input.volunteerType) {
          await Volunteer.create({
            playerId: input.playerId,
            gameId: input.gameId,
            volunteerType: input.volunteerType,
            volunteerTypeOther: input.volunteerTypeOther ?? "",
          });
        }

        void recordPlayerRegisteredNotification({
          gameId: input.gameId,
          playerId: input.playerId,
          playerName: formatPlayerDisplayName(input.firstName, input.lastName),
        }).catch(() => {});

        const emailResult = await sendRegistrationWelcomeEmail({
          to: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          personalQrCode: input.personalQrCode,
          gameId: input.gameId,
          gameTitle: input.gameTitle,
        });
        await Player.findByIdAndUpdate(
          input.playerId,
          buildWelcomeEmailPlayerUpdate(emailResult),
        );
      } catch {
        // Background — registration already succeeded.
      }
    })();
  });
}

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

      const gameContext = await loadRegistrationGameContext(gameId);
      if (!gameContext) {
        return NextResponse.json({ message: "Game not found." }, { status: 404 });
      }
      const { formVariant, showPlayerQr, gameTitle } = gameContext;

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

      const personalQrCode = `P-${nanoid(10)}`;

      // Duplicate check and photo upload are independent — run together.
      const [duplicatePlayer, uploadedPhoto] = await Promise.all([
        findPlayerAlreadyRegisteredForGame(payload.gameId, {
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
        }),
        photoFile
          ? uploadRegistrationPhoto(photoFile, {
              gameId: payload.gameId,
              firstName: payload.firstName,
              lastName: payload.lastName,
            })
          : Promise.resolve(null),
      ]);

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

      const photoUrl = uploadedPhoto?.photoUrl ?? getGeneratedAvatarUrl(personalQrCode);
      const photoPublicId = uploadedPhoto?.photoPublicId ?? GENERATED_AVATAR_PUBLIC_ID;

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

      // Player is in the queue — respond immediately. Email / QR / extras continue in background.
      const isVolunteer = isVolunteerNewPlayerPayload(payload);
      const ccfPayload =
        !isVolunteer && formVariant !== "generic" ? (payload as NewPlayerInput) : null;

      queueBackgroundRegistrationWork({
        gameId: payload.gameId,
        gameTitle,
        playerId: String(player._id),
        firstName: player.firstName,
        lastName: player.lastName,
        email: player.email,
        personalQrCode: player.personalQrCode,
        prayerRequest: ccfPayload?.prayerRequest,
        volunteerType: isVolunteer ? payload.volunteerType : undefined,
        volunteerTypeOther: isVolunteer ? payload.volunteerTypeOther : undefined,
      });

      const message = showPlayerQr
        ? "Registration complete. Save your personal QR for next time — we also emailed your QR ID."
        : "Registration complete. A welcome email with your personal QR ID is on the way.";

      return NextResponse.json({
        player: {
          _id: player._id,
          firstName: player.firstName,
          lastName: player.lastName,
          personalQrCode: player.personalQrCode,
        },
        showPlayerQr,
        message,
      });
    });
  } catch (error) {
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
