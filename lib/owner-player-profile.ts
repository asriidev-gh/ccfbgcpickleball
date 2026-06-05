import { uploadProfilePhoto } from "@/lib/cloudinary";
import { connectToDatabase } from "@/lib/db";
import { getBlockedEmailsForOrganizer } from "@/lib/organizer-blocked-player";
import { assertPlayerRegisteredWithOwner, resolvePlayerSiblings } from "@/lib/owner-player-actions";
import {
  deriveCcfEventsBefore,
  type GenderOption,
  type PickleballLevel,
} from "@/lib/player-profile-shared";
import type { OwnerPlayerProfile } from "@/lib/owner-registered-players-shared";
import { getRegistrationFormVariant } from "@/lib/registration-variant";
import { capitalizeNameWords } from "@/lib/utils";
import {
  profileBaseSchema,
  profileCcfFieldsSchema,
  type ProfileCcfFieldsInput,
} from "@/lib/validations";
import { Player } from "@/models/Player";
import { User } from "@/models/User";

async function organizerShowsCcfQuestionnaire(ownerId: string) {
  const owner = await User.findById(ownerId).select("userType").lean();
  const userType =
    owner && typeof owner === "object" && typeof owner.userType === "string"
      ? owner.userType
      : undefined;
  return getRegistrationFormVariant(userType) === "ccf";
}

function pickBestPlayerDoc(
  docs: Array<{
    _id: { toString(): string };
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    photoUrl?: string | null;
    gender?: string | null;
    birthdate?: Date | null;
    biography?: string | null;
    pickleballLevel?: string | null;
    isPartOfDgroup?: boolean | null;
    wantsToJoinDgroup?: boolean | null;
    attendedEvents?: string[] | null;
    attendedEventsOther?: string | null;
  }>,
  preferredId: string,
) {
  return docs.find((doc) => doc._id.toString() === preferredId) ?? docs[0];
}

export async function getOwnerPlayerProfile(
  ownerId: string,
  playerId: string,
): Promise<OwnerPlayerProfile | null> {
  await connectToDatabase();
  await assertPlayerRegisteredWithOwner(ownerId, playerId);

  const resolved = await resolvePlayerSiblings(playerId);
  if (!resolved) return null;

  const siblings = await Player.find({ _id: { $in: resolved.playerObjectIds } }).lean();
  const player = pickBestPlayerDoc(siblings, playerId);
  if (!player) return null;

  const [showCcfQuestionnaire, blockedEmails] = await Promise.all([
    organizerShowsCcfQuestionnaire(ownerId),
    getBlockedEmailsForOrganizer(ownerId),
  ]);

  const email = player.email ?? resolved.player.email ?? "";
  return {
    playerId,
    email,
    showCcfQuestionnaire,
    isBlocked: blockedEmails.has(email.trim().toLowerCase()),
    firstName: player.firstName ?? "",
    lastName: player.lastName ?? "",
    mobileNumber: player.mobileNumber ?? "",
    photoUrl: player.photoUrl?.trim() ?? "",
    gender: (player.gender as GenderOption | undefined) ?? "",
    birthdate: player.birthdate ? player.birthdate.toISOString().slice(0, 10) : "",
    biography: player.biography?.trim() ?? "",
    pickleballLevel: (player.pickleballLevel as PickleballLevel | undefined) ?? "",
    isPartOfDgroup: player.isPartOfDgroup ?? null,
    wantsToJoinDgroup: player.wantsToJoinDgroup ?? null,
    attendedEvents: player.attendedEvents ?? [],
    attendedEventsOther: player.attendedEventsOther?.trim() ?? "",
    ccfEventsBefore: showCcfQuestionnaire
      ? deriveCcfEventsBefore(player.attendedEvents)
      : null,
  };
}

type ProfileUpdatePayload = ReturnType<typeof profileBaseSchema.parse> &
  Partial<ProfileCcfFieldsInput>;

export async function updateOwnerPlayerProfile(
  ownerId: string,
  playerId: string,
  payload: ProfileUpdatePayload,
  photoFile: File | null,
  showCcfQuestionnaire: boolean,
) {
  await connectToDatabase();
  await assertPlayerRegisteredWithOwner(ownerId, playerId);

  const resolved = await resolvePlayerSiblings(playerId);
  if (!resolved) throw new Error("Player not found.");

  let photoUrl: string | undefined;
  let photoPublicId: string | undefined;

  if (photoFile) {
    const uploaded = await uploadProfilePhoto(photoFile, {
      gameId: ownerId,
      playerId,
      firstName: payload.firstName,
      lastName: payload.lastName,
    });
    photoUrl = uploaded.photoUrl;
    photoPublicId = uploaded.photoPublicId;
  }

  const update: Record<string, unknown> = {
    firstName: capitalizeNameWords(payload.firstName),
    lastName: capitalizeNameWords(payload.lastName),
    mobileNumber: payload.mobileNumber,
    gender: payload.gender || "",
    biography: payload.biography,
    pickleballLevel: payload.pickleballLevel || "",
    ...(photoUrl && photoPublicId ? { photoUrl, photoPublicId } : {}),
  };

  if (payload.birthdate) {
    update.birthdate = new Date(`${payload.birthdate}T12:00:00.000Z`);
  }

  if (showCcfQuestionnaire && "attendedEvents" in payload && payload.attendedEvents) {
    update.isPartOfDgroup = payload.isPartOfDgroup ?? false;
    update.wantsToJoinDgroup = payload.wantsToJoinDgroup ?? null;
    update.attendedEvents = payload.attendedEvents;
    update.attendedEventsOther = payload.attendedEventsOther ?? "";
  }

  await Player.updateMany({ _id: { $in: resolved.playerObjectIds } }, { $set: update });

  if (!payload.birthdate) {
    await Player.updateMany(
      { _id: { $in: resolved.playerObjectIds } },
      { $unset: { birthdate: "" } },
    );
  }

  const profile = await getOwnerPlayerProfile(ownerId, playerId);
  if (!profile) throw new Error("Player not found.");
  return profile;
}

export async function parseOwnerProfileUpdate(
  ownerId: string,
  body: unknown,
  formData: FormData | null,
  showCcfQuestionnaire: boolean,
) {
  if (formData) {
    const { parseProfilePayloadFromFormData, getProfilePhotoFromFormData } = await import(
      "@/lib/parse-profile-form"
    );
    const parsed = parseProfilePayloadFromFormData(formData, showCcfQuestionnaire);
    if (!parsed.success) return { error: parsed.error } as const;
    return {
      payload: parsed.data,
      photoFile: getProfilePhotoFromFormData(formData),
    } as const;
  }

  const baseParsed = profileBaseSchema.safeParse(body);
  if (!baseParsed.success) return { error: baseParsed.error } as const;

  let payload: ProfileUpdatePayload = baseParsed.data;
  if (showCcfQuestionnaire) {
    const ccfParsed = profileCcfFieldsSchema.safeParse(body);
    if (!ccfParsed.success) return { error: ccfParsed.error } as const;
    payload = { ...payload, ...ccfParsed.data };
  }

  return { payload, photoFile: null } as const;
}
