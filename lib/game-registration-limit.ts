import type { RegistrationFormVariant } from "@/lib/registration-variant";
import { connectToDatabase } from "@/lib/db";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";

export class RegistrationLimitError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "RegistrationLimitError";
    this.status = status;
  }
}

export async function getGameRegistrationCount(gameId: string) {
  const playerIds = await QueueEntry.distinct("playerId", { gameId });
  return playerIds.length;
}

export type GameRegistrationStatus = {
  gameId: string;
  formVariant: RegistrationFormVariant;
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

  const formVariant = await resolveGameRegistrationFormVariant(gameId);
  if (!formVariant) return null;

  const registeredCount = await getGameRegistrationCount(gameId);
  const strict = game.strictPlayerCount === true;
  const allowQrRegistration = game.allowQrRegistration !== false;
  const isFull =
    game.status === "ended" ||
    (strict && registeredCount >= game.expectedPlayers);

  return {
    gameId: game.gameId,
    formVariant,
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
  options?: { playerId?: string },
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

  if (options?.playerId) {
    const alreadyRegistered = await QueueEntry.exists({
      gameId,
      playerId: options.playerId,
    });
    if (alreadyRegistered) {
      throw new RegistrationLimitError("You are already registered for this session.", 409);
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
