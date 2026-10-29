import { connectToDatabase } from "@/lib/db";
import {
  isPlayerEndorsementBadge,
  MAX_PLAYER_ENDORSEMENT_BADGES,
  MAX_PLAYER_ENDORSEMENT_NOTES,
  type PlayerEndorsementBadge,
} from "@/lib/player-endorsement-shared";
import { assertPlayerRegisteredForGame, PlayerProfileAccessError } from "@/lib/player-profile";
import { leaderboardIdentityKey } from "@/lib/player-identity-key";
import { formatPlayerDisplayName } from "@/lib/utils";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { PlayerEndorsement } from "@/models/PlayerEndorsement";
import { QueueEntry } from "@/models/QueueEntry";

export type SpectatePlayerEndorsementSummary = {
  endorsedPlayerId: string;
  badges: PlayerEndorsementBadge[];
  notes: string;
  createdAt: string;
};

export type SpectatePlayerEndorsementReceived = {
  endorserPlayerId: string;
  endorserPlayerName: string;
  endorserFirstName: string;
  endorserLastName: string;
  photoUrl?: string;
  photoPublicId?: string;
  personalQrCode?: string;
  badges: PlayerEndorsementBadge[];
  notes: string;
  createdAt: string;
};

export async function assertEndorsedPlayerInGame(gameId: string, endorsedPlayerId: string) {
  const entry = await QueueEntry.findOne({ gameId, playerId: endorsedPlayerId })
    .select("_id")
    .lean();
  if (!entry) {
    throw new PlayerProfileAccessError("That player is not in this open play.", 404);
  }
}

export async function listSpectatePlayerEndorsements(
  gameId: string,
  endorserPlayerId: string,
): Promise<SpectatePlayerEndorsementSummary[]> {
  await assertPlayerRegisteredForGame(gameId, endorserPlayerId);

  const rows = await PlayerEndorsement.find({ gameId, endorserPlayerId })
    .sort({ createdAt: -1 })
    .lean();

  return rows.map((row) => ({
    endorsedPlayerId: String(row.endorsedPlayerId),
    badges: row.badges as PlayerEndorsementBadge[],
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getSpectatePlayerEndorsement(
  gameId: string,
  endorserPlayerId: string,
  endorsedPlayerId: string,
) {
  await assertPlayerRegisteredForGame(gameId, endorserPlayerId);

  const row = await PlayerEndorsement.findOne({
    gameId,
    endorserPlayerId,
    endorsedPlayerId,
  }).lean();

  if (!row) return null;

  return {
    endorsedPlayerId: String(row.endorsedPlayerId),
    badges: row.badges as PlayerEndorsementBadge[],
    notes: row.notes ?? "",
    createdAt: row.createdAt.toISOString(),
  } satisfies SpectatePlayerEndorsementSummary;
}

export async function listSpectateGameEndorsementCounts(
  gameId: string,
): Promise<Record<string, number>> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("_id").lean();
  if (!game) {
    throw new PlayerProfileAccessError("Game not found.", 404);
  }

  const rows = await PlayerEndorsement.aggregate<{ _id: unknown; count: number }>([
    { $match: { gameId } },
    { $group: { _id: "$endorsedPlayerId", count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[String(row._id)] = row.count;
  }
  return counts;
}

/**
 * Identity keys (see leaderboardIdentityKey) of everyone this person has ever endorsed in any
 * of the host's sessions. Each session registers a fresh Player row, so matching is by name,
 * the same way the all-time standings treat one person. Used to hide Endorse for repeats.
 */
export async function listEndorsedIdentityKeysForEndorser(
  gameId: string,
  endorserPlayerId: string,
): Promise<string[]> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId?: unknown } | null>();
  if (!game?.ownerId) return [];

  const ownerGames = await PickleGame.find({ ownerId: game.ownerId })
    .select("gameId")
    .lean<Array<{ gameId: string }>>();
  const endorsements = await PlayerEndorsement.find({
    gameId: { $in: ownerGames.map((item) => item.gameId) },
  })
    .select("endorserPlayerId endorsedPlayerId")
    .lean();
  if (endorsements.length === 0) return [];

  const endorserIds = [...new Set(endorsements.map((row) => String(row.endorserPlayerId)))];
  const endorserPlayers = await Player.find({ _id: { $in: endorserIds } })
    .select("firstName lastName email")
    .lean<Array<{ _id: { toString(): string }; firstName?: string; lastName?: string; email?: string }>>();
  const self = endorserPlayers.find((player) => player._id.toString() === endorserPlayerId);
  if (!self) return [];

  const selfKey = leaderboardIdentityKey(self);
  const myIds = new Set(
    endorserPlayers
      .filter((player) => leaderboardIdentityKey(player) === selfKey)
      .map((player) => player._id.toString()),
  );
  const endorsedIds = [
    ...new Set(
      endorsements
        .filter((row) => myIds.has(String(row.endorserPlayerId)))
        .map((row) => String(row.endorsedPlayerId)),
    ),
  ];
  if (endorsedIds.length === 0) return [];

  const endorsedPlayers = await Player.find({ _id: { $in: endorsedIds } })
    .select("firstName lastName email")
    .lean<Array<{ _id: { toString(): string }; firstName?: string; lastName?: string; email?: string }>>();
  return [...new Set(endorsedPlayers.map((player) => leaderboardIdentityKey(player)))];
}

export async function listSpectatePlayerEndorsementsReceived(
  gameId: string,
  endorsedPlayerId: string,
): Promise<SpectatePlayerEndorsementReceived[]> {
  await connectToDatabase();

  const game = await PickleGame.findOne({ gameId }).select("_id").lean();
  if (!game) {
    throw new PlayerProfileAccessError("Game not found.", 404);
  }
  await assertEndorsedPlayerInGame(gameId, endorsedPlayerId);

  const rows = await PlayerEndorsement.find({ gameId, endorsedPlayerId })
    .sort({ createdAt: -1 })
    .populate("endorserPlayerId", "firstName lastName photoUrl photoPublicId personalQrCode")
    .lean();

  return rows.map((row) => {
    const endorser = row.endorserPlayerId as
      | {
          _id?: unknown;
          firstName?: string;
          lastName?: string;
          photoUrl?: string;
          photoPublicId?: string;
          personalQrCode?: string;
        }
      | null
      | undefined;
    const endorserPlayerId = endorser?._id != null ? String(endorser._id) : String(row.endorserPlayerId);
    const endorserFirstName = endorser?.firstName ?? "";
    const endorserLastName = endorser?.lastName ?? "";

    return {
      endorserPlayerId,
      endorserPlayerName:
        formatPlayerDisplayName(endorserFirstName, endorserLastName) || "Player",
      endorserFirstName,
      endorserLastName,
      photoUrl: endorser?.photoUrl,
      photoPublicId: endorser?.photoPublicId,
      personalQrCode: endorser?.personalQrCode,
      badges: row.badges as PlayerEndorsementBadge[],
      notes: row.notes ?? "",
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function submitSpectatePlayerEndorsement(input: {
  gameId: string;
  endorserPlayerId: string;
  endorsedPlayerId: string;
  badges: string[];
  notes?: string;
}) {
  await connectToDatabase();

  if (input.endorserPlayerId === input.endorsedPlayerId) {
    throw new PlayerProfileAccessError("You cannot endorse yourself.", 400);
  }

  const game = await PickleGame.findOne({ gameId: input.gameId }).select("status").lean();
  if (!game) {
    throw new PlayerProfileAccessError("Game not found.", 404);
  }
  if (game.status !== "active") {
    throw new PlayerProfileAccessError("Open play is not active.", 400);
  }

  await assertPlayerRegisteredForGame(input.gameId, input.endorserPlayerId);
  await assertEndorsedPlayerInGame(input.gameId, input.endorsedPlayerId);

  const badges = Array.from(new Set(input.badges.filter(isPlayerEndorsementBadge)));
  if (badges.length === 0 || badges.length > MAX_PLAYER_ENDORSEMENT_BADGES) {
    throw new PlayerProfileAccessError(`Select 1 to ${MAX_PLAYER_ENDORSEMENT_BADGES} badges.`, 400);
  }

  const notes = input.notes?.trim().slice(0, MAX_PLAYER_ENDORSEMENT_NOTES) ?? "";

  const existing = await PlayerEndorsement.findOne({
    gameId: input.gameId,
    endorserPlayerId: input.endorserPlayerId,
    endorsedPlayerId: input.endorsedPlayerId,
  });

  if (existing) {
    throw new PlayerProfileAccessError("You already endorsed this player for this open play.", 409);
  }

  const [endorser, endorsed] = await Promise.all([
    Player.findById(input.endorserPlayerId).select("firstName lastName").lean(),
    Player.findById(input.endorsedPlayerId).select("firstName lastName").lean(),
  ]);

  if (!endorser || !endorsed) {
    throw new PlayerProfileAccessError("Player not found.", 404);
  }

  const created = await PlayerEndorsement.create({
    gameId: input.gameId,
    endorserPlayerId: input.endorserPlayerId,
    endorsedPlayerId: input.endorsedPlayerId,
    badges,
    notes,
  });

  return {
    endorsementId: String(created._id),
    endorsedPlayerId: input.endorsedPlayerId,
    endorsedPlayerName:
      formatPlayerDisplayName(endorsed.firstName, endorsed.lastName) || "Player",
    endorserPlayerName:
      formatPlayerDisplayName(endorser.firstName, endorser.lastName) || "Player",
    badges,
    notes,
    createdAt: created.createdAt.toISOString(),
  };
}
