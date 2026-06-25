import type { OwnerCourtsViewPayload } from "@/lib/owner-courts-view-payload";
import { resolveGameFormatSettings } from "@/lib/game-format-settings";
import { loadQueueCourtsAndCheckedOut } from "@/lib/load-spectate-game";
import {
  loadFirstTimerIdentityKeysForGame,
  serializeQueueEntriesForPayload,
} from "@/lib/queue-first-timer";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { PickleGame } from "@/models/PickleGame";
import "@/models/Player";

const ACTIVE_GAME_FIELDS =
  "title gameId openPlayType courtCount status openPlayDate openPlayTimeRange gameMode matchingType";

export async function loadOwnerCourtsView(ownerId: string): Promise<OwnerCourtsViewPayload> {
  const games = await PickleGame.find({ ownerId, status: "active" })
    .sort({ createdAt: -1 })
    .select(ACTIVE_GAME_FIELDS)
    .lean();

  const sessions = await Promise.all(
    games.map(async (game) => {
      const [{ courts, queue, checkedOut }, leaderboard, firstTimerIdentityKeys] = await Promise.all([
        loadQueueCourtsAndCheckedOut(game.gameId),
        LeaderboardStats.find({ gameId: game.gameId })
          .select("playerId gamesPlayed wins losses")
          .populate("playerId"),
        loadFirstTimerIdentityKeysForGame(ownerId, game.gameId),
      ]);

      const format = resolveGameFormatSettings(game);

      return {
        gameId: game.gameId,
        title: game.title,
        openPlayType: game.openPlayType,
        courtCount: game.courtCount,
        status: game.status as OwnerCourtsViewPayload["sessions"][number]["status"],
        openPlayDate: game.openPlayDate ? new Date(game.openPlayDate).toISOString() : null,
        openPlayTimeRange: game.openPlayTimeRange ?? null,
        gameMode: format.gameMode,
        matchingType: format.matchingType,
        courts: courts as unknown as OwnerCourtsViewPayload["sessions"][number]["courts"],
        queue: serializeQueueEntriesForPayload(
          queue as Parameters<typeof serializeQueueEntriesForPayload>[0],
          firstTimerIdentityKeys,
        ) as unknown as OwnerCourtsViewPayload["sessions"][number]["queue"],
        checkedOut: serializeQueueEntriesForPayload(
          checkedOut as Parameters<typeof serializeQueueEntriesForPayload>[0],
          firstTimerIdentityKeys,
        ) as unknown as OwnerCourtsViewPayload["sessions"][number]["checkedOut"],
        leaderboard:
          leaderboard as OwnerCourtsViewPayload["sessions"][number]["leaderboard"],
      };
    }),
  );

  return { sessions };
}
