import { connectToDatabase } from "@/lib/db";
import type { PlayerGameHistory, PlayerGameHistoryEntry } from "@/lib/insights-shared";
import { computeSessionInsights } from "@/lib/session-insights";
import { formatPlayerTableName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";

type PopulatedStat = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  playerId: {
    _id: { toString(): string };
    firstName?: string;
    lastName?: string;
    photoUrl?: string | null;
    photoPublicId?: string | null;
    personalQrCode?: string;
  } | null;
};

async function computeGameAwardsForPlayer(gameId: string, playerIds: Set<string>) {
  const [stats, matches] = await Promise.all([
    LeaderboardStats.find({ gameId }).populate("playerId"),
    MatchHistory.find({ gameId })
      .sort({ endedAt: 1 })
      .populate(["teamAPlayerIds", "teamBPlayerIds"]),
  ]);

  const safeStats = (stats as unknown as PopulatedStat[]).filter((row) => Boolean(row.playerId));

  const insights = computeSessionInsights(
    matches.map((m) => ({
      endedAt: m.endedAt,
      courtNumber: m.courtNumber,
      teamAPlayerIds: m.teamAPlayerIds,
      teamBPlayerIds: m.teamBPlayerIds,
      winnerTeam: m.winnerTeam,
      durationSeconds: m.durationSeconds,
    })),
    safeStats.map((row) => ({
      playerId: String(row.playerId!._id),
      name: formatPlayerTableName(row.playerId!.firstName ?? "", row.playerId!.lastName ?? ""),
      firstName: row.playerId!.firstName ?? "",
      lastName: row.playerId!.lastName ?? "",
      photoUrl: row.playerId!.photoUrl,
      photoPublicId: row.playerId!.photoPublicId,
      personalQrCode: row.playerId!.personalQrCode,
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      losses: row.losses,
      winRate: row.winRate,
      currentStreak: row.currentStreak,
    })),
  );

  const deduped = new Map<string, { id: string; title: string; stat?: string }>();
  for (const insight of insights) {
    if (insight.players.some((p) => playerIds.has(p.playerId))) {
      deduped.set(insight.id, { id: insight.id, title: insight.title, stat: insight.stat });
    }
  }
  return [...deduped.values()];
}

export async function getPlayerGameHistory(
  playerId: string,
): Promise<PlayerGameHistory | null> {
  await connectToDatabase();

  const player = await Player.findById(playerId)
    .select("firstName lastName email")
    .lean<{ firstName?: string; lastName?: string; email?: string } | null>();
  if (!player) return null;

  // Collapse every Player doc that belongs to the same person (same name +
  // email), so games and records are combined across open plays.
  const siblings = await Player.find({
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email,
  })
    .select("_id")
    .lean<Array<{ _id: { toString(): string } }>>();
  const playerObjectIds = siblings.map((doc) => doc._id.toString());
  const playerIdSet = new Set(playerObjectIds);

  const [queueGameIds, statGameIds] = await Promise.all([
    QueueEntry.distinct("gameId", { playerId: { $in: playerObjectIds } }),
    LeaderboardStats.distinct("gameId", { playerId: { $in: playerObjectIds } }),
  ]);
  const gameIds = Array.from(
    new Set([...(queueGameIds as string[]), ...(statGameIds as string[])]),
  );

  const games = await PickleGame.find({ gameId: { $in: gameIds } })
    .select("gameId title status createdAt ownerId")
    .lean<
      Array<{
        gameId: string;
        title: string;
        status: string;
        createdAt?: Date;
        ownerId?: { toString(): string };
      }>
    >();
  const gameMap = new Map(games.map((g) => [g.gameId, g]));

  const ownerIds = games.map((g) => g.ownerId).filter(Boolean) as Array<{ toString(): string }>;
  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("name")
    .lean<Array<{ _id: { toString(): string }; name?: string }>>();
  const ownerMap = new Map(owners.map((o) => [o._id.toString(), o.name ?? "Unknown"]));

  const entries: PlayerGameHistoryEntry[] = await Promise.all(
    gameIds.map(async (gameId) => {
      const [playerStats, firstQueue, awards] = await Promise.all([
        LeaderboardStats.find({ gameId, playerId: { $in: playerObjectIds } }).lean<
          Array<{ gamesPlayed?: number; wins?: number; losses?: number }>
        >(),
        QueueEntry.findOne({ gameId, playerId: { $in: playerObjectIds } })
          .sort({ registeredAt: 1 })
          .select("registeredAt")
          .lean<{ registeredAt?: Date } | null>(),
        computeGameAwardsForPlayer(gameId, playerIdSet),
      ]);

      const game = gameMap.get(gameId);
      const joinedAt = firstQueue?.registeredAt ?? game?.createdAt ?? null;

      const gamesPlayed = playerStats.reduce((sum, s) => sum + (s.gamesPlayed ?? 0), 0);
      const wins = playerStats.reduce((sum, s) => sum + (s.wins ?? 0), 0);
      const losses = playerStats.reduce((sum, s) => sum + (s.losses ?? 0), 0);

      return {
        gameId,
        title: game?.title ?? "Untitled game",
        status: game?.status ?? "unknown",
        ownerName: game?.ownerId ? (ownerMap.get(game.ownerId.toString()) ?? "Unknown") : "Unknown",
        joinedAt: joinedAt ? new Date(joinedAt).toISOString() : null,
        gamesPlayed,
        wins,
        losses,
        winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
        awards,
      };
    }),
  );

  entries.sort((a, b) => {
    const at = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
    const bt = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
    return bt - at;
  });

  return {
    player: {
      id: playerId,
      name: formatPlayerTableName(player.firstName ?? "", player.lastName ?? ""),
    },
    totalGamesPlayed: entries.length,
    games: entries,
  };
}
