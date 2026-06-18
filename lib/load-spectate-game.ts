import { loadGameLeaderboardRecap } from "@/lib/game-leaderboard-recap";
import { getGameBirthdaysThisMonth } from "@/lib/game-birthdays-this-month";
import { resolveClubBranding } from "@/lib/club-branding";
import {
  loadFirstTimerIdentityKeysForGame,
  serializeQueueEntriesForPayload,
} from "@/lib/queue-first-timer";
import type { SpectateDetailsPayload, SpectateLivePayload } from "@/lib/spectate-payload";
import { getSpectatorCount } from "@/lib/spectator-presence";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { User } from "@/models/User";
import "@/models/Player";

const LIVE_GAME_FIELDS =
  "title openPlayType courtCount gameId status openPlayDate openPlayTimeRange ownerId";

export type SpectateScope = "live" | "details" | "full";

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

  return { queue, checkedOut, courts };
}

export async function loadSpectateLive(gameId: string): Promise<SpectateLivePayload | null> {
  const game = await PickleGame.findOne({ gameId }).select(LIVE_GAME_FIELDS);
  if (!game) return null;

  const ownerId = game.ownerId?.toString();
  const [owner, queueState, firstTimerIdentityKeys, birthdaysThisMonth] = await Promise.all([
    ownerId
      ? User.findById(ownerId).select("name clubName clubLogoUrl").lean()
      : Promise.resolve(null),
    loadQueueCourtsAndCheckedOut(gameId),
    ownerId ? loadFirstTimerIdentityKeysForGame(ownerId, gameId) : Promise.resolve(new Set<string>()),
    getGameBirthdaysThisMonth(gameId),
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
    spectatorCount: getSpectatorCount(gameId),
    firstTimerCount: firstTimerIdentityKeys.size,
    birthdayThisMonthCount: birthdaysThisMonth.count,
    clubBranding: owner ? resolveClubBranding(owner) : null,
  };
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
