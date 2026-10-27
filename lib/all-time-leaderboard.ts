import { getPlayerIdentityKey } from "@/lib/owner-session-insight-filter-shared";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";

/** One person's combined record across every session run by the owner. */
export type AllTimeLeaderboardRow = {
  /** Identity key, stable across the duplicate Player rows a person can accumulate. */
  id: string;
  playerId: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  photoPublicId?: string;
  personalQrCode?: string;
  /** "male" | "female" | "prefer_not_to_say", or "" when the player never set it. */
  gender: string;
  /** A PICKLEBALL_LEVELS value, or "" when the player never set it. */
  pickleballLevel: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  /** Whole percent, 0-100. */
  winRate: number;
  sessionsPlayed: number;
};

export type AllTimeLeaderboardPayload = {
  rows: AllTimeLeaderboardRow[];
  totals: {
    players: number;
    sessions: number;
    gamesPlayed: number;
  };
};

type StatsDoc = {
  gameId: string;
  playerId: { toString(): string };
  wins?: number;
  losses?: number;
  gamesPlayed?: number;
};

type PlayerDoc = {
  _id: { toString(): string };
  firstName?: string;
  lastName?: string;
  email?: string;
  photoUrl?: string;
  photoPublicId?: string;
  personalQrCode?: string;
  gender?: string;
  pickleballLevel?: string;
};

type Accumulator = {
  id: string;
  playerId: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
  photoPublicId: string;
  personalQrCode: string;
  gender: string;
  pickleballLevel: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  sessions: Set<string>;
};

/** Duplicate profiles are often partly filled, so keep the first non-empty value seen. */
function coalesce(current: string, incoming: string | undefined) {
  return current || (incoming ?? "").trim();
}

function winRateOf(wins: number, gamesPlayed: number) {
  if (gamesPlayed <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((wins / gamesPlayed) * 100)));
}

function compareRows(a: AllTimeLeaderboardRow, b: AllTimeLeaderboardRow) {
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.winRate !== a.winRate) return b.winRate - a.winRate;
  if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
  return `${a.firstName} ${a.lastName}`.trim().localeCompare(`${b.firstName} ${b.lastName}`.trim());
}

/**
 * All-time standings for every player who has completed at least one match in one of this
 * owner's sessions. Per-session rows are summed per person, so someone who re-registered
 * across sessions appears once. Call inside runWithDatabase.
 */
export async function loadAllTimeLeaderboard(ownerId: string): Promise<AllTimeLeaderboardPayload> {
  const empty: AllTimeLeaderboardPayload = {
    rows: [],
    totals: { players: 0, sessions: 0, gamesPlayed: 0 },
  };

  const ownerGames = await PickleGame.find({ ownerId })
    .select("gameId")
    .lean<Array<{ gameId: string }>>();
  const ownerGameIds = ownerGames.map((game) => game.gameId);
  if (ownerGameIds.length === 0) return empty;

  const stats = await LeaderboardStats.find({ gameId: { $in: ownerGameIds } })
    .select("gameId playerId wins losses gamesPlayed")
    .lean<StatsDoc[]>();
  if (stats.length === 0) return empty;

  const playerIds = [...new Set(stats.map((row) => row.playerId.toString()))];
  const players = await Player.find({ _id: { $in: playerIds } })
    .select("firstName lastName email photoUrl photoPublicId personalQrCode gender pickleballLevel")
    .lean<PlayerDoc[]>();
  const playersById = new Map(players.map((player) => [player._id.toString(), player]));

  const groups = new Map<string, Accumulator>();

  for (const row of stats) {
    // A stats row can outlive its Player if the player was removed; skip rather than guess.
    const player = playersById.get(row.playerId.toString());
    if (!player) continue;

    const wins = row.wins ?? 0;
    const losses = row.losses ?? 0;
    const gamesPlayed = row.gamesPlayed ?? wins + losses;
    if (gamesPlayed <= 0 && wins <= 0 && losses <= 0) continue;

    const key = getPlayerIdentityKey({
      _id: player._id,
      email: player.email,
      firstName: player.firstName,
      lastName: player.lastName,
    });

    const existing = groups.get(key);
    if (existing) {
      existing.wins += wins;
      existing.losses += losses;
      existing.gamesPlayed += gamesPlayed;
      existing.sessions.add(row.gameId);
      if (!existing.photoUrl && player.photoUrl) {
        existing.photoUrl = player.photoUrl.trim();
        existing.photoPublicId = (player.photoPublicId ?? "").trim();
      }
      existing.personalQrCode = coalesce(existing.personalQrCode, player.personalQrCode);
      existing.gender = coalesce(existing.gender, player.gender);
      existing.pickleballLevel = coalesce(existing.pickleballLevel, player.pickleballLevel);
      continue;
    }

    groups.set(key, {
      id: key,
      playerId: player._id.toString(),
      firstName: player.firstName ?? "",
      lastName: player.lastName ?? "",
      photoUrl: (player.photoUrl ?? "").trim(),
      photoPublicId: (player.photoPublicId ?? "").trim(),
      personalQrCode: (player.personalQrCode ?? "").trim(),
      gender: (player.gender ?? "").trim(),
      pickleballLevel: (player.pickleballLevel ?? "").trim(),
      wins,
      losses,
      gamesPlayed,
      sessions: new Set([row.gameId]),
    });
  }

  const rows: AllTimeLeaderboardRow[] = [...groups.values()]
    .map((group) => ({
      id: group.id,
      playerId: group.playerId,
      firstName: group.firstName,
      lastName: group.lastName,
      photoUrl: group.photoUrl,
      photoPublicId: group.photoPublicId,
      personalQrCode: group.personalQrCode,
      gender: group.gender,
      pickleballLevel: group.pickleballLevel,
      wins: group.wins,
      losses: group.losses,
      gamesPlayed: group.gamesPlayed,
      winRate: winRateOf(group.wins, group.gamesPlayed),
      sessionsPlayed: group.sessions.size,
    }))
    .sort(compareRows);

  const countedSessions = new Set<string>();
  for (const group of groups.values()) {
    for (const gameId of group.sessions) countedSessions.add(gameId);
  }

  return {
    rows,
    totals: {
      players: rows.length,
      sessions: countedSessions.size,
      gamesPlayed: rows.reduce((sum, row) => sum + row.gamesPlayed, 0),
    },
  };
}
