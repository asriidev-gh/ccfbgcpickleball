import type { RegistrationFeature } from "@/lib/registration-feature";
import type { RegistrationFormVariant } from "@/lib/registration-variant";
import { connectToDatabase } from "@/lib/db";
import { resolveGameRegistrationFeature } from "@/lib/resolve-game-registration-feature";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { isEmailBlockedForGame, ORGANIZER_BLOCKED_REGISTRATION_MESSAGE } from "@/lib/organizer-blocked-player";
import {
  ALREADY_REGISTERED_MESSAGE,
  CHECKED_OUT_RE_REGISTER_MESSAGE,
} from "@/lib/registration-messages";

const ACTIVE_QUEUE_STATUSES = ["queued", "on_court", "done"] as const;

export type PlayerQueueStatusForGame = "active" | "checked_out" | null;

export async function getPlayerQueueStatusForGame(
  gameId: string,
  playerId: string,
): Promise<PlayerQueueStatusForGame> {
  await connectToDatabase();

  const activeEntry = await QueueEntry.exists({
    gameId,
    playerId,
    status: { $in: ACTIVE_QUEUE_STATUSES },
  });
  if (activeEntry) return "active";

  const checkedOutEntry = await QueueEntry.exists({
    gameId,
    playerId,
    status: "checked_out",
  });
  if (checkedOutEntry) return "checked_out";

  return null;
}

export class RegistrationLimitError extends Error {
  status: number;
  playerId?: string;
  alreadyRegistered?: boolean;
  checkedOut?: boolean;

  constructor(
    message: string,
    status = 403,
    options?: { playerId?: string; alreadyRegistered?: boolean; checkedOut?: boolean },
  ) {
    super(message);
    this.name = "RegistrationLimitError";
    this.status = status;
    this.playerId = options?.playerId;
    this.alreadyRegistered = options?.alreadyRegistered;
    this.checkedOut = options?.checkedOut;
  }
}

export async function getGameRegistrationCount(gameId: string) {
  const playerIds = await QueueEntry.distinct("playerId", { gameId });
  return playerIds.length;
}

export type GameRegistrationStatus = {
  gameId: string;
  formVariant: RegistrationFormVariant;
  registrationFeature: RegistrationFeature;
  strictPlayerCount: boolean;
  allowQrRegistration: boolean;
  expectedPlayers: number;
  registeredCount: number;
  isFull: boolean;
  spotsRemaining: number | null;
  status: "draft" | "active" | "ended";
};

export async function getGameRegistrationStatus(
  gameId: string,
): Promise<GameRegistrationStatus | null> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select(
    "gameId expectedPlayers strictPlayerCount allowQrRegistration status",
  );
  if (!game) return null;

  const [formVariant, registrationFeature] = await Promise.all([
    resolveGameRegistrationFormVariant(gameId),
    resolveGameRegistrationFeature(gameId),
  ]);
  if (!formVariant || !registrationFeature) return null;

  const registeredCount = await getGameRegistrationCount(gameId);
  const strict = game.strictPlayerCount === true;
  const allowQrRegistration = game.allowQrRegistration !== false;
  const isFull =
    game.status === "ended" ||
    (strict && registeredCount >= game.expectedPlayers);

  return {
    gameId: game.gameId,
    formVariant,
    registrationFeature,
    strictPlayerCount: strict,
    allowQrRegistration,
    expectedPlayers: game.expectedPlayers,
    registeredCount,
    isFull,
    spotsRemaining: strict
      ? Math.max(0, game.expectedPlayers - registeredCount)
      : null,
    status: game.status,
  };
}

export async function assertGameRegistrationAllowed(
  gameId: string,
  options?: { playerId?: string; email?: string },
) {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select(
    "expectedPlayers strictPlayerCount status",
  );
  if (!game) {
    throw new RegistrationLimitError("Game not found.", 404);
  }
  if (game.status === "ended") {
    throw new RegistrationLimitError("Registration is closed for this session.", 403);
  }

  if (options?.email && (await isEmailBlockedForGame(gameId, options.email))) {
    throw new RegistrationLimitError(ORGANIZER_BLOCKED_REGISTRATION_MESSAGE, 403);
  }

  if (options?.playerId) {
    const queueStatus = await getPlayerQueueStatusForGame(gameId, options.playerId);
    if (queueStatus === "active") {
      throw new RegistrationLimitError(ALREADY_REGISTERED_MESSAGE, 409, {
        playerId: options.playerId,
        alreadyRegistered: true,
      });
    }
    if (queueStatus === "checked_out") {
      throw new RegistrationLimitError(CHECKED_OUT_RE_REGISTER_MESSAGE, 409, {
        playerId: options.playerId,
        alreadyRegistered: true,
        checkedOut: true,
      });
    }
  }

  if (game.strictPlayerCount !== true) {
    return game;
  }

  const count = await getGameRegistrationCount(gameId);
  if (count >= game.expectedPlayers) {
    throw new RegistrationLimitError(
      `Registration is full. This session is limited to ${game.expectedPlayers} players.`,
      403,
    );
  }

  return game;
}
