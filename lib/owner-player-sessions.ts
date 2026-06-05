import { connectToDatabase } from "@/lib/db";
import type { OwnerPlayerSessions } from "@/lib/owner-registered-players-shared";
import { formatPlayerTableName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

async function getSiblingPlayerIds(playerId: string) {
  const player = await Player.findById(playerId)
    .select("firstName lastName email")
    .lean<{ firstName?: string; lastName?: string; email?: string } | null>();
  if (!player) return null;

  const siblings = await Player.find({
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email,
  })
    .select("_id")
    .lean<Array<{ _id: { toString(): string } }>>();

  return {
    player,
    playerObjectIds: siblings.map((doc) => doc._id.toString()),
  };
}

export async function getOwnerPlayerSessions(
  ownerId: string,
  playerId: string,
): Promise<OwnerPlayerSessions | null> {
  await connectToDatabase();

  const resolved = await getSiblingPlayerIds(playerId);
  if (!resolved) return null;

  const ownerGames = await PickleGame.find({ ownerId })
    .select("gameId title status openPlayType courtCount createdAt")
    .lean<
      Array<{
        gameId: string;
        title: string;
        status: string;
        openPlayType: string;
        courtCount: number;
        createdAt?: Date;
      }>
    >();

  if (ownerGames.length === 0) {
    return {
      player: {
        id: playerId,
        name: formatPlayerTableName(resolved.player.firstName ?? "", resolved.player.lastName ?? ""),
        email: resolved.player.email ?? "",
      },
      sessions: [],
    };
  }

  const ownerGameIds = ownerGames.map((game) => game.gameId);
  const gameMap = new Map(ownerGames.map((game) => [game.gameId, game]));

  const [queueGameIds, statGameIds] = await Promise.all([
    QueueEntry.distinct("gameId", {
      gameId: { $in: ownerGameIds },
      playerId: { $in: resolved.playerObjectIds },
    }),
    LeaderboardStats.distinct("gameId", {
      gameId: { $in: ownerGameIds },
      playerId: { $in: resolved.playerObjectIds },
    }),
  ]);

  const sessionGameIds = Array.from(
    new Set([...(queueGameIds as string[]), ...(statGameIds as string[])]),
  );

  const sessions = await Promise.all(
    sessionGameIds.map(async (gameId) => {
      const [playerStats, firstQueue] = await Promise.all([
        LeaderboardStats.find({
          gameId,
          playerId: { $in: resolved.playerObjectIds },
        }).lean<Array<{ gamesPlayed?: number; wins?: number; losses?: number }>>(),
        QueueEntry.findOne({ gameId, playerId: { $in: resolved.playerObjectIds } })
          .sort({ registeredAt: 1 })
          .select("registeredAt status")
          .lean<{ registeredAt?: Date; status?: string } | null>(),
      ]);

      const game = gameMap.get(gameId);
      const gamesPlayed = playerStats.reduce((sum, row) => sum + (row.gamesPlayed ?? 0), 0);
      const wins = playerStats.reduce((sum, row) => sum + (row.wins ?? 0), 0);
      const losses = playerStats.reduce((sum, row) => sum + (row.losses ?? 0), 0);

      return {
        gameId,
        title: game?.title ?? "Untitled session",
        status: game?.status ?? "unknown",
        openPlayType: game?.openPlayType ?? "",
        courtCount: game?.courtCount ?? 0,
        queueStatus: firstQueue?.status ?? null,
        registeredAt: firstQueue?.registeredAt
          ? new Date(firstQueue.registeredAt).toISOString()
          : game?.createdAt
            ? new Date(game.createdAt).toISOString()
            : null,
        gamesPlayed,
        wins,
        losses,
        winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
      };
    }),
  );

  sessions.sort((a, b) => {
    const at = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
    const bt = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
    return bt - at;
  });

  return {
    player: {
      id: playerId,
      name: formatPlayerTableName(resolved.player.firstName ?? "", resolved.player.lastName ?? ""),
      email: resolved.player.email ?? "",
    },
    sessions,
  };
}
