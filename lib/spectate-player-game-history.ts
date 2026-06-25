import { resolvePlayerSiblings } from "@/lib/owner-player-actions";
import { formatOpenPlayScheduleLabel, formatVenueShareLabel } from "@/lib/open-play-time-range";
import { assertPlayerRegisteredForGame } from "@/lib/player-profile";
import type { SpectatePlayerGameHistory } from "@/lib/spectate-player-game-history-shared";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";

export async function getSpectatePlayerGameHistory(
  currentGameId: string,
  playerId: string,
): Promise<SpectatePlayerGameHistory> {
  await assertPlayerRegisteredForGame(currentGameId, playerId);

  const resolved = await resolvePlayerSiblings(playerId);
  if (!resolved) {
    return { games: [] };
  }

  const { playerObjectIds } = resolved;

  const [queueGameIds, statGameIds] = await Promise.all([
    QueueEntry.distinct("gameId", { playerId: { $in: playerObjectIds } }),
    LeaderboardStats.distinct("gameId", { playerId: { $in: playerObjectIds } }),
  ]);
  const gameIds = Array.from(
    new Set([...(queueGameIds as string[]), ...(statGameIds as string[])]),
  );

  if (gameIds.length === 0) {
    return { games: [] };
  }

  const games = await PickleGame.find({
    gameId: { $in: gameIds },
    status: "ended",
  })
    .select("gameId title openPlayDate openPlayTimeRange venueName venueAddress createdAt")
    .lean<
      Array<{
        gameId: string;
        title: string;
        openPlayDate?: Date;
        openPlayTimeRange?: string;
        venueName?: string;
        venueAddress?: string;
        createdAt?: Date;
      }>
    >();

  const entries = await Promise.all(
    games.map(async (game) => {
      const firstQueue = await QueueEntry.findOne({
        gameId: game.gameId,
        playerId: { $in: playerObjectIds },
      })
        .sort({ registeredAt: 1 })
        .select("registeredAt")
        .lean<{ registeredAt?: Date } | null>();

      const joinedAt = firstQueue?.registeredAt ?? game.createdAt ?? null;

      return {
        gameId: game.gameId,
        title: game.title,
        scheduleLabel: formatOpenPlayScheduleLabel(game.openPlayDate, game.openPlayTimeRange),
        venueLabel: formatVenueShareLabel(game.venueName, game.venueAddress),
        joinedAt: joinedAt ? new Date(joinedAt).toISOString() : null,
      };
    }),
  );

  entries.sort((a, b) => {
    const at = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
    const bt = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
    return bt - at;
  });

  return { games: entries };
}
