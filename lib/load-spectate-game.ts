import { loadGameLeaderboardRecap } from "@/lib/game-leaderboard-recap";
import { getGameBirthdaysThisMonth } from "@/lib/game-birthdays-this-month";
import { resolveClubBranding } from "@/lib/club-branding";
import {
  loadFirstTimerIdentityKeysForGame,
  serializeQueueEntriesForPayload,
} from "@/lib/queue-first-timer";
import type { SpectateDetailsPayload, SpectateLivePayload } from "@/lib/spectate-payload";
import {
  firstTimerCacheKey,
  getCachedBirthdayThisMonthCount,
  getCachedFirstTimerIdentityKeys,
  setCachedBirthdayThisMonthCount,
  setCachedFirstTimerIdentityKeys,
} from "@/lib/spectate-live-meta-cache";
import { getSpectatorCount } from "@/lib/spectator-presence";
import { normalizePlayerPhotoRef } from "@/lib/player-avatar-url";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";
import "@/models/Player";

const LIVE_GAME_FIELDS =
  "title openPlayType courtCount gameId status openPlayDate openPlayTimeRange venueName venueAddress ownerId";

export type SpectateScope = "live" | "details" | "history" | "recap" | "full";

type CourtDoc = {
  toObject?: () => Record<string, unknown>;
  teamA?: { playerIds?: unknown[] };
  teamB?: { playerIds?: unknown[] };
};

function serializeCourtForPayload(court: CourtDoc) {
  const plain = (court.toObject?.() ?? court) as Record<string, unknown> & {
    teamA?: { playerIds?: unknown[] };
    teamB?: { playerIds?: unknown[] };
  };

  const mapTeam = (team?: { playerIds?: unknown[] }) => ({
    ...team,
    playerIds: (team?.playerIds ?? []).map((player) => normalizePlayerPhotoRef(player)),
  });

  return {
    ...plain,
    teamA: mapTeam(plain.teamA),
    teamB: mapTeam(plain.teamB),
  };
}

export async function loadQueueCourtsAndCheckedOut(gameId: string) {
  const [queue, checkedOut, courts] = await Promise.all([
    QueueEntry.find({ gameId, status: "queued" })
      .sort({ registeredAt: 1 })
      .populate("playerId"),
    QueueEntry.find({ gameId, status: "checked_out" })
      .sort({ updatedAt: -1 })
      .populate("playerId"),
    Court.find({ gameId }).sort({ courtNumber: 1 }).populate([
      "teamA.playerIds",
      "teamB.playerIds",
    ]),
  ]);

  return {
    queue,
    checkedOut,
    courts: courts.map((court) => serializeCourtForPayload(court as CourtDoc)),
  };
}

export async function loadSpectateLive(gameId: string): Promise<SpectateLivePayload | null> {
  const game = await PickleGame.findOne({ gameId }).select(LIVE_GAME_FIELDS);
  if (!game) return null;

  const ownerId = game.ownerId?.toString();
  const firstTimerKey = ownerId ? firstTimerCacheKey(ownerId, gameId) : null;

  const cachedFirstTimerKeys = firstTimerKey
    ? getCachedFirstTimerIdentityKeys(firstTimerKey)
    : null;
  const cachedBirthdayCount = getCachedBirthdayThisMonthCount(gameId);

  const [owner, queueState, leaderboardRows, firstTimerIdentityKeys, birthdaysThisMonth] =
    await Promise.all([
      ownerId
        ? User.findById(ownerId).select("name clubName clubLogoUrl clubTagline").lean()
        : Promise.resolve(null),
      loadQueueCourtsAndCheckedOut(gameId),
      LeaderboardStats.find({ gameId }).select("playerId gamesPlayed wins losses").lean(),
      cachedFirstTimerKeys != null
        ? Promise.resolve(cachedFirstTimerKeys)
        : ownerId
          ? loadFirstTimerIdentityKeysForGame(ownerId, gameId).then((keys) => {
              if (firstTimerKey) setCachedFirstTimerIdentityKeys(firstTimerKey, keys);
              return keys;
            })
          : Promise.resolve(new Set<string>()),
      cachedBirthdayCount != null
        ? Promise.resolve({ count: cachedBirthdayCount, players: [] })
        : getGameBirthdaysThisMonth(gameId).then((result) => {
            setCachedBirthdayThisMonthCount(gameId, result.count);
            return result;
          }),
    ]);
  const { queue, checkedOut, courts } = queueState;

  return {
    game: game.toObject() as SpectateLivePayload["game"],
    queue: serializeQueueEntriesForPayload(
      queue as Parameters<typeof serializeQueueEntriesForPayload>[0],
      firstTimerIdentityKeys,
    ) as unknown as SpectateLivePayload["queue"],
    checkedOut: serializeQueueEntriesForPayload(
      checkedOut as Parameters<typeof serializeQueueEntriesForPayload>[0],
      firstTimerIdentityKeys,
    ) as unknown as SpectateLivePayload["checkedOut"],
    courts: courts as unknown as SpectateLivePayload["courts"],
    leaderboard: leaderboardRows as unknown as SpectateLivePayload["leaderboard"],
    spectatorCount: getSpectatorCount(gameId),
    firstTimerCount: firstTimerIdentityKeys.size,
    birthdayThisMonthCount: birthdaysThisMonth.count,
    clubBranding: owner ? resolveClubBranding(owner) : null,
  };
}

export async function loadSpectateMatchHistory(
  gameId: string,
): Promise<{ matches: SpectateDetailsPayload["matches"] } | null> {
  const game = await PickleGame.findOne({ gameId }).select("gameId").lean();
  if (!game) return null;

  const matches = await MatchHistory.find({ gameId })
    .sort({ endedAt: -1 })
    .populate(["teamAPlayerIds", "teamBPlayerIds"]);

  return {
    matches: matches as unknown as SpectateDetailsPayload["matches"],
  };
}

export async function loadSpectateRecap(gameId: string): Promise<SpectateDetailsPayload["recap"] | null> {
  const game = await PickleGame.findOne({ gameId }).select("status").lean();
  if (!game) return null;
  if (game.status !== "ended") return undefined;

  return (await loadGameLeaderboardRecap(gameId)) ?? undefined;
}

export async function loadSpectateDetails(gameId: string): Promise<SpectateDetailsPayload | null> {
  const game = await PickleGame.findOne({ gameId }).select("status");
  if (!game) return null;

  const [leaderboard, matches, recap] = await Promise.all([
    LeaderboardStats.find({ gameId }).select("playerId gamesPlayed wins losses").populate("playerId"),
    MatchHistory.find({ gameId })
      .sort({ endedAt: -1 })
      .populate(["teamAPlayerIds", "teamBPlayerIds"]),
    game.status === "ended" ? loadGameLeaderboardRecap(gameId) : Promise.resolve(null),
  ]);

  return {
    leaderboard: leaderboard as unknown as SpectateDetailsPayload["leaderboard"],
    matches: matches as unknown as SpectateDetailsPayload["matches"],
    recap: recap ?? undefined,
  };
}

export async function loadSpectateFull(gameId: string) {
  const [live, details] = await Promise.all([loadSpectateLive(gameId), loadSpectateDetails(gameId)]);
  if (!live || !details) return null;

  return {
    ...live,
    ...details,
  };
}
