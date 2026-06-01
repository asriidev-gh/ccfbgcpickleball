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

/** e.g. "1 game/s (W1/L0)" */
export function formatSessionRecordLabel(stats: PlayerSessionStats) {
  const { gamesPlayed, wins, losses } = stats;
  return `${gamesPlayed} game/s (W${wins}/L${losses})`;
}

export function attachSessionStatsToQueueEntry<
  T extends { playerId: { _id?: { toString(): string } | string } },
>(
  entry: T,
  map: Map<string, PlayerSessionStats>,
): T & PlayerSessionStats {
  const stats = getPlayerSessionStats(map, entry.playerId._id);
  return { ...entry, ...stats };
}
