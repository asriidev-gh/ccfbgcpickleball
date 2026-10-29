import { leaderboardIdentityKey } from "@/lib/all-time-leaderboard";
import type { PlayerEndorsementBadge } from "@/lib/player-endorsement-shared";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { PlayerEndorsement } from "@/models/PlayerEndorsement";

/** One endorsement received by a leaderboard player, with who gave it and in which session. */
export type AllTimeEndorsementReceived = {
  endorserName: string;
  /** Public avatar only; QR codes are never included. */
  photoUrl?: string;
  photoPublicId?: string;
  badges: PlayerEndorsementBadge[];
  notes: string;
  sessionTitle: string;
  createdAt: string;
};

type NamedPlayer = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  photoUrl?: string;
  photoPublicId?: string;
};

function displayName(player: NamedPlayer | undefined) {
  return `${player?.firstName ?? ""} ${player?.lastName ?? ""}`.trim() || "Player";
}

/**
 * Every endorsement received by one leaderboard row across the owner's sessions, newest first.
 * `identityKey` is the row's `id`, so duplicate profiles of the same person are combined,
 * matching how the leaderboard counts them. Call inside runWithDatabase.
 */
export async function listAllTimeEndorsementsReceived(
  ownerId: string,
  identityKey: string,
): Promise<AllTimeEndorsementReceived[]> {
  const games = await PickleGame.find({ ownerId })
    .select("gameId title")
    .lean<Array<{ gameId: string; title?: string }>>();
  if (games.length === 0) return [];
  const titleByGameId = new Map(games.map((game) => [game.gameId, game.title?.trim() || "Open play"]));

  const endorsements = await PlayerEndorsement.find({ gameId: { $in: [...titleByGameId.keys()] } })
    .select("gameId endorserPlayerId endorsedPlayerId badges notes createdAt")
    .lean();
  if (endorsements.length === 0) return [];

  const endorsedIds = [...new Set(endorsements.map((row) => String(row.endorsedPlayerId)))];
  const endorsedPlayers = await Player.find({ _id: { $in: endorsedIds } })
    .select("firstName lastName email")
    .lean<NamedPlayer[]>();
  const matchingIds = new Set(
    endorsedPlayers
      .filter((player) => leaderboardIdentityKey(player) === identityKey)
      .map((player) => player._id.toString()),
  );

  const matches = endorsements.filter((row) => matchingIds.has(String(row.endorsedPlayerId)));
  if (matches.length === 0) return [];

  const endorserIds = [...new Set(matches.map((row) => String(row.endorserPlayerId)))];
  const endorsers = await Player.find({ _id: { $in: endorserIds } })
    .select("firstName lastName photoUrl photoPublicId")
    .lean<NamedPlayer[]>();
  const endorserById = new Map(endorsers.map((player) => [player._id.toString(), player]));

  return matches
    .map((row) => {
      const endorser = endorserById.get(String(row.endorserPlayerId));
      return {
        endorserName: displayName(endorser),
        photoUrl: endorser?.photoUrl,
        photoPublicId: endorser?.photoPublicId,
        badges: row.badges as PlayerEndorsementBadge[],
        notes: row.notes ?? "",
        sessionTitle: titleByGameId.get(row.gameId) ?? "Open play",
        createdAt: row.createdAt.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
