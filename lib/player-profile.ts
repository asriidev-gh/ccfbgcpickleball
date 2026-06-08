import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  deriveCcfEventsBefore,
  type GenderOption,
  type PickleballLevel,
} from "@/lib/player-profile-shared";
import { getRegistrationFormVariant } from "@/lib/registration-variant";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";

export class PlayerProfileAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function isValidPlayerId(playerId: string) {
  return mongoose.Types.ObjectId.isValid(playerId);
}

export async function assertPlayerRegisteredForGame(gameId: string, playerId: string) {
  if (!isValidPlayerId(playerId)) {
    throw new PlayerProfileAccessError("Invalid player session.", 400);
  }

  await connectToDatabase();
  const entry = await QueueEntry.findOne({ gameId, playerId }).select("_id").lean();
  if (!entry) {
    throw new PlayerProfileAccessError(
      "You must be registered for this open play to update your profile.",
      403,
    );
  }
}

export async function resolveGameShowsCcfQuestionnaire(gameId: string) {
  await connectToDatabase();
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean();
  if (!game) return false;

  const owner = await User.findById(game.ownerId).select("userType").lean();
  const userType =
    owner && typeof owner === "object" && typeof owner.userType === "string"
      ? owner.userType
      : undefined;

  return getRegistrationFormVariant(userType) === "ccf";
}

type PlayerProfileDoc = {
  _id: { toString(): string };
  firstName: string;
  lastName: string;
  mobileNumber: string;
  email: string;
  photoUrl?: string | null;
  gender?: string | null;
  birthdate?: Date | null;
  biography?: string | null;
  pickleballLevel?: string | null;
  isPartOfDgroup?: boolean | null;
  wantsToJoinDgroup?: boolean | null;
  attendedEvents?: string[] | null;
  attendedEventsOther?: string | null;
  personalQrCode?: string | null;
};

export function serializePlayerProfile(
  player: PlayerProfileDoc,
  showCcfQuestionnaire: boolean,
) {
  return {
    playerId: player._id.toString(),
    email: player.email,
    showCcfQuestionnaire,
    firstName: player.firstName,
    lastName: player.lastName,
    mobileNumber: player.mobileNumber,
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
    personalQrCode: player.personalQrCode?.trim() ?? "",
  };
}

export async function loadPlayerProfileForGame(gameId: string, playerId: string) {
  await assertPlayerRegisteredForGame(gameId, playerId);

  const [player, showCcfQuestionnaire] = await Promise.all([
    Player.findById(playerId).lean(),
    resolveGameShowsCcfQuestionnaire(gameId),
  ]);

  if (!player) {
    throw new PlayerProfileAccessError("Player profile not found.", 404);
  }

  return {
    profile: serializePlayerProfile(player, showCcfQuestionnaire),
    showCcfQuestionnaire,
    player,
  };
}
