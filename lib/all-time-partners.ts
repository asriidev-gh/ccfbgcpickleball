import {
  MIN_PARTNER_GAMES,
  type AllTimePartnerPair,
  type AllTimePartnerPlayer,
} from "@/lib/all-time-partners-shared";
import { leaderboardIdentityKey } from "@/lib/player-identity-key";
import { MatchHistory } from "@/models/MatchHistory";
import { Player } from "@/models/Player";

type MatchDoc = {
  teamAPlayerIds?: Array<{ toString(): string }>;
  teamBPlayerIds?: Array<{ toString(): string }>;
  winnerTeam?: "A" | "B";
};

type PlayerDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  photoUrl?: string;
  photoPublicId?: string;
};

/**
 * Who partnered with whom across the owner's sessions. Only doubles sides (exactly two
 * players) count, and people are matched by name the way the all-time rows are, so a person
 * who re-registered each session is one partner. Pairs under MIN_PARTNER_GAMES are dropped.
 * Call inside runWithDatabase.
 */
export async function loadAllTimePartnerPairs(
  ownerGameIds: string[],
  knownPlayers: Map<string, PlayerDoc>,
): Promise<AllTimePartnerPair[]> {
  const matches = await MatchHistory.find({ gameId: { $in: ownerGameIds } })
    .select("teamAPlayerIds teamBPlayerIds winnerTeam")
    .lean<MatchDoc[]>();

  const sides: Array<{ ids: [string, string]; won: boolean }> = [];
  for (const match of matches) {
    for (const [team, ids] of [
      ["A", match.teamAPlayerIds],
      ["B", match.teamBPlayerIds],
    ] as const) {
      if (!ids || ids.length !== 2) continue;
      sides.push({
        ids: [ids[0].toString(), ids[1].toString()],
        won: match.winnerTeam === team,
      });
    }
  }
  if (sides.length === 0) return [];

  // Matches can name players that never got a stats row, so fetch any we haven't loaded.
  const missing = [
    ...new Set(sides.flatMap((side) => side.ids).filter((id) => !knownPlayers.has(id))),
  ];
  const players = new Map(knownPlayers);
  if (missing.length > 0) {
    const extra = await Player.find({ _id: { $in: missing } })
      .select("firstName lastName email photoUrl photoPublicId")
      .lean<PlayerDoc[]>();
    for (const player of extra) players.set(player._id.toString(), player);
  }

  const people = new Map<string, AllTimePartnerPlayer>();
  const keyOf = (playerId: string) => {
    const player = players.get(playerId);
    if (!player) return null;
    const key = leaderboardIdentityKey(player);
    const existing = people.get(key);
    const photoUrl = (player.photoUrl ?? "").trim();
    if (!existing) {
      people.set(key, {
        id: key,
        firstName: player.firstName ?? "",
        lastName: player.lastName ?? "",
        photoUrl,
        photoPublicId: (player.photoPublicId ?? "").trim(),
      });
    } else if (!existing.photoUrl && photoUrl) {
      existing.photoUrl = photoUrl;
      existing.photoPublicId = (player.photoPublicId ?? "").trim();
    }
    return key;
  };

  const pairs = new Map<string, { keys: [string, string]; wins: number; losses: number }>();
  for (const side of sides) {
    const first = keyOf(side.ids[0]);
    const second = keyOf(side.ids[1]);
    // A person's duplicate profiles can land on one side; that isn't a partnership.
    if (!first || !second || first === second) continue;

    const keys = (first < second ? [first, second] : [second, first]) as [string, string];
    const id = keys.join("||");
    const pair = pairs.get(id) ?? { keys, wins: 0, losses: 0 };
    if (side.won) pair.wins += 1;
    else pair.losses += 1;
    pairs.set(id, pair);
  }

  return [...pairs.entries()]
    .map(([id, pair]) => {
      const gamesTogether = pair.wins + pair.losses;
      return {
        id,
        players: [people.get(pair.keys[0])!, people.get(pair.keys[1])!] as [
          AllTimePartnerPlayer,
          AllTimePartnerPlayer,
        ],
        gamesTogether,
        wins: pair.wins,
        losses: pair.losses,
        winRate: Math.round((pair.wins / gamesTogether) * 100),
      };
    })
    // Pairs that never won together aren't ranked, however often they played.
    .filter((pair) => pair.gamesTogether >= MIN_PARTNER_GAMES && pair.wins > 0)
    .sort(
      (a, b) =>
        b.winRate - a.winRate || b.gamesTogether - a.gamesTogether || b.wins - a.wins,
    );
}
