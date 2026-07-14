import {
  normalizeRegistrationFeature,
  REGISTRATION_FEATURE_DEFAULT,
  type RegistrationFeature,
} from "@/lib/registration-feature";
import {
  getRegistrationFormVariant,
  type RegistrationFormVariant,
} from "@/lib/registration-variant";
import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";
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

  const entry = await QueueEntry.findOne({ gameId, playerId })
    .sort({ registeredAt: -1 })
    .select("status")
    .lean<{ status?: string } | null>();

  if (!entry?.status) return null;
  if ((ACTIVE_QUEUE_STATUSES as readonly string[]).includes(entry.status)) return "active";
  if (entry.status === "checked_out") return "checked_out";
  return null;
}

export async function assertPlayerCheckedInForGame(gameId: string, playerId: string) {
  const queueStatus = await getPlayerQueueStatusForGame(gameId, playerId);
  if (queueStatus !== "active") {
    throw new RegistrationLimitError(
      "Check in to this open play to access the marketplace.",
      403,
    );
  }
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
  // Distinct player ids is cheaper than a 3-stage aggregation for capacity checks.
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

export type GameRegistrationPagePayload = GameRegistrationStatus & {
  gameTitle: string;
};

type LoadedRegistrationGame = {
  gameId: string;
  title?: string;
  expectedPlayers?: number;
  strictPlayerCount?: boolean;
  allowQrRegistration?: boolean;
  status?: "draft" | "active" | "ended";
  ownerId?: unknown;
};

function resolveOwnerRegistrationSettings(owner: {
  userType?: string;
  registrationFeature?: string;
} | null) {
  const userType =
    owner && typeof owner === "object" && typeof owner.userType === "string"
      ? owner.userType
      : undefined;

  return {
    formVariant: getRegistrationFormVariant(userType),
    registrationFeature: owner
      ? normalizeRegistrationFeature(
          typeof owner.registrationFeature === "string"
            ? owner.registrationFeature
            : undefined,
        )
      : REGISTRATION_FEATURE_DEFAULT,
  };
}

function buildGameRegistrationStatus(
  game: LoadedRegistrationGame,
  registeredCount: number,
  settings: {
    formVariant: RegistrationFormVariant;
    registrationFeature: RegistrationFeature;
  },
): GameRegistrationStatus {
  const strict = game.strictPlayerCount === true;
  const allowQrRegistration = game.allowQrRegistration !== false;
  const expectedPlayers = game.expectedPlayers ?? 0;
  const status = game.status ?? "draft";
  const isFull = status === "ended" || (strict && registeredCount >= expectedPlayers);

  return {
    gameId: game.gameId,
    formVariant: settings.formVariant,
    registrationFeature: settings.registrationFeature,
    strictPlayerCount: strict,
    allowQrRegistration,
    expectedPlayers,
    registeredCount,
    isFull,
    spotsRemaining: strict ? Math.max(0, expectedPlayers - registeredCount) : null,
    status,
  };
}

/** Warm-instance cache so repeated QR scans during open play skip redundant DB work. */
const PAGE_PAYLOAD_CACHE_TTL_MS = 45_000;
const pagePayloadCache = new Map<
  string,
  { expiresAt: number; payload: GameRegistrationPagePayload }
>();

export async function getGameRegistrationPagePayload(
  gameId: string,
): Promise<GameRegistrationPagePayload | null> {
  const cached = pagePayloadCache.get(gameId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId })
    .select(
      "gameId title expectedPlayers strictPlayerCount allowQrRegistration status ownerId",
    )
    .lean<LoadedRegistrationGame | null>();
  if (!game) return null;

  const strict = game.strictPlayerCount === true;

  // Owner settings + optional capacity count in parallel (one round-trip each).
  const [owner, registeredCount] = await Promise.all([
    game.ownerId
      ? User.findById(game.ownerId)
          .select("userType registrationFeature")
          .lean<{
            userType?: string;
            registrationFeature?: string;
          } | null>()
      : Promise.resolve(null),
    // Capacity count is only needed for strict sessions; skip the scan otherwise.
    strict ? getGameRegistrationCount(gameId) : Promise.resolve(0),
  ]);

  const settings = resolveOwnerRegistrationSettings(owner);
  const status = buildGameRegistrationStatus(game, registeredCount, settings);

  const payload: GameRegistrationPagePayload = {
    ...status,
    gameTitle: game.title ?? "",
  };

  pagePayloadCache.set(gameId, {
    expiresAt: Date.now() + PAGE_PAYLOAD_CACHE_TTL_MS,
    payload,
  });

  return payload;
}

export async function getGameRegistrationStatus(
  gameId: string,
): Promise<(GameRegistrationStatus & { gameTitle: string }) | null> {
  const payload = await getGameRegistrationPagePayload(gameId);
  if (!payload) return null;
  return payload;
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
