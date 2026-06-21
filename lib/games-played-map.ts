export type PlayerSessionStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
};

export type LeaderboardGamesPlayedRow = {
  playerId?: { _id?: { toString(): string } | string } | string | null;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
};

function resolvePlayerId(
  playerId: { _id?: { toString(): string } | string } | string | null | undefined,
): string | null {
  if (playerId == null) return null;
  if (typeof playerId === "object" && "_id" in playerId && playerId._id != null) {
    return String(playerId._id);
  }
  return String(playerId);
}

export function buildPlayerSessionStatsMap(
  rows: LeaderboardGamesPlayedRow[] | undefined,
): Map<string, PlayerSessionStats> {
  const map = new Map<string, PlayerSessionStats>();
  for (const row of rows ?? []) {
    const id = resolvePlayerId(row.playerId);
    if (!id) continue;
    map.set(id, {
      gamesPlayed: row.gamesPlayed ?? 0,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
    });
  }
  return map;
}

export function getPlayerSessionStats(
  map: Map<string, PlayerSessionStats>,
  playerId: { _id?: { toString(): string } | string } | string | null | undefined,
): PlayerSessionStats {
  const id = resolvePlayerId(playerId);
  if (!id) return { gamesPlayed: 0, wins: 0, losses: 0 };
  return map.get(id) ?? { gamesPlayed: 0, wins: 0, losses: 0 };
}

/** e.g. "(W1/L0)" */
export function formatSessionRecordLabel(stats: PlayerSessionStats) {
  const { wins, losses } = stats;
  return `(W${wins}/L${losses})`;
}

/** e.g. "(W1/L1/Rank:1)" when rank is known; falls back to wins/losses only. */
export function formatSessionRecordWithRankLabel(
  stats: PlayerSessionStats,
  rank?: number | null,
) {
  const { wins, losses } = stats;
  if (rank == null) return formatSessionRecordLabel(stats);
  return `(W${wins}/L${losses}/Rank:${rank})`;
}

function leaderboardWinRate(stats: Pick<PlayerSessionStats, "wins" | "losses" | "gamesPlayed">) {
  const gamesPlayed = stats.gamesPlayed || stats.wins + stats.losses;
  return gamesPlayed > 0 ? Math.round((stats.wins / gamesPlayed) * 100) : 0;
}

/** Rank map keyed by player id (1 = top of session leaderboard). */
export function buildPlayerLeaderboardRankMap(
  rows: LeaderboardGamesPlayedRow[] | undefined,
): Map<string, number> {
  const ranked = (rows ?? [])
    .map((row) => {
      const id = resolvePlayerId(row.playerId);
      if (!id) return null;
      const wins = row.wins ?? 0;
      const losses = row.losses ?? 0;
      const gamesPlayed = row.gamesPlayed ?? wins + losses;
      const stats = { wins, losses, gamesPlayed };
      return { id, ...stats, winRate: leaderboardWinRate(stats) };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return b.gamesPlayed - a.gamesPlayed;
    });

  const map = new Map<string, number>();
  ranked.forEach((entry, index) => {
    map.set(entry.id, index + 1);
  });
  return map;
}

export function getPlayerLeaderboardRank(
  map: Map<string, number>,
  playerId: { _id?: { toString(): string } | string } | string | null | undefined,
): number | null {
  const id = resolvePlayerId(playerId);
  if (!id) return null;
  return map.get(id) ?? null;
}

/** At least 3 wins this session and no losses yet. */
export function isSessionUndefeated(stats: Pick<PlayerSessionStats, "wins" | "losses">) {
  return stats.wins >= 3 && stats.losses === 0;
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** Badge for the next game this session, e.g. "1st game", "2nd game". */
export function formatUpcomingGameBadgeLabel(gamesPlayed: number) {
  const nextGame = Math.max(1, gamesPlayed + 1);
  return `${nextGame}${ordinalSuffix(nextGame)} game`;
}

export function attachSessionStatsToQueueEntry<
  T extends { playerId: { _id?: { toString(): string } | string } },
>(
  entry: T,
  map: Map<string, PlayerSessionStats>,
): T & PlayerSessionStats {
  const stats = getPlayerSessionStats(map, entry.playerId);
  return { ...entry, ...stats };
}
