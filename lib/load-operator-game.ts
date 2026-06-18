import { ensureGameRegistrationQr } from "@/lib/game-qr";
import { resolveClubBranding } from "@/lib/club-branding";
import { getGameBirthdaysThisMonth } from "@/lib/game-birthdays-this-month";
import { loadGameLeaderboardRecap } from "@/lib/game-leaderboard-recap";
import { loadQueueCourtsAndCheckedOut } from "@/lib/load-spectate-game";
import {
  loadFirstTimerIdentityKeysForGame,
  serializeQueueEntriesForPayload,
} from "@/lib/queue-first-timer";
import type {
  OperatorDetailsPayload,
  OperatorQueuePayload,
  OperatorShellPayload,
} from "@/lib/operator-payload";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";
import "@/models/Player";

const OPERATOR_LIVE_GAME_FIELDS =
  "title openPlayType courtCount gameId status openPlayDate openPlayTimeRange allowQrRegistration";

export type OperatorScope = "shell" | "queue" | "live" | "details" | "full";

export async function loadOperatorShell(
  gameId: string,
  ownerId: string,
): Promise<OperatorShellPayload | null> {
  const [game, owner] = await Promise.all([
    PickleGame.findOne({ gameId, ownerId }).select(OPERATOR_LIVE_GAME_FIELDS),
    User.findById(ownerId).select("name clubName clubLogoUrl").lean(),
  ]);
  if (!game) return null;

  return {
    game: game.toObject() as OperatorShellPayload["game"],
    clubBranding: owner ? resolveClubBranding(owner) : null,
  };
}

export async function loadOperatorQueueState(
  gameId: string,
  ownerId: string,
): Promise<OperatorQueuePayload | null> {
  const game = await PickleGame.findOne({ gameId, ownerId }).select("status");
  if (!game) return null;

  const { queue, checkedOut, courts } = await loadQueueCourtsAndCheckedOut(gameId);
  const [firstTimerIdentityKeys, birthdaysThisMonth] = await Promise.all([
    loadFirstTimerIdentityKeysForGame(ownerId, gameId),
    getGameBirthdaysThisMonth(gameId),
  ]);

  return {
    status: game.status as OperatorQueuePayload["status"],
    queue: serializeQueueEntriesForPayload(
      queue as Parameters<typeof serializeQueueEntriesForPayload>[0],
      firstTimerIdentityKeys,
    ) as unknown as OperatorQueuePayload["queue"],
    checkedOut: serializeQueueEntriesForPayload(
      checkedOut as Parameters<typeof serializeQueueEntriesForPayload>[0],
      firstTimerIdentityKeys,
    ) as unknown as OperatorQueuePayload["checkedOut"],
    courts: courts as unknown as OperatorQueuePayload["courts"],
    firstTimerCount: firstTimerIdentityKeys.size,
    birthdayThisMonthCount: birthdaysThisMonth.count,
  };
}

export async function loadOperatorDetails(
  gameId: string,
  ownerId: string,
): Promise<OperatorDetailsPayload | null> {
  const game = await PickleGame.findOne({ gameId, ownerId });
  if (!game) return null;

  const [leaderboard, matches, recap, qr] = await Promise.all([
    LeaderboardStats.find({ gameId }).sort({ wins: -1 }).populate("playerId"),
    MatchHistory.find({ gameId })
      .sort({ endedAt: -1 })
      .populate(["teamAPlayerIds", "teamBPlayerIds"]),
    game.status === "ended" ? loadGameLeaderboardRecap(gameId) : Promise.resolve(null),
    ensureGameRegistrationQr(game),
  ]);

  return {
    leaderboard: leaderboard as unknown as OperatorDetailsPayload["leaderboard"],
    matches: matches as unknown as OperatorDetailsPayload["matches"],
    recap: recap ?? undefined,
    qr: {
      registerUrl: qr.registerUrl,
      publicQrCodeDataUrl: qr.publicQrCodeDataUrl,
    },
  };
}

export async function loadOperatorFull(gameId: string, ownerId: string) {
  const [shell, queue, details] = await Promise.all([
    loadOperatorShell(gameId, ownerId),
    loadOperatorQueueState(gameId, ownerId),
    loadOperatorDetails(gameId, ownerId),
  ]);
  if (!shell || !queue || !details) return null;

  return { shell, queue, details };
}
