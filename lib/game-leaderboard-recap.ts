import { computeSessionInsights, type SessionInsight } from "@/lib/session-insights";
import { getSessionInsightIdentityKeys } from "@/lib/owner-session-insight-filter";
import { getPlayerIdentityKey } from "@/lib/owner-session-insight-filter-shared";
import { formatPlayerTableName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import "@/models/Player";

export type GameLeaderboardRecapRow = {
  id: string;
  playerId: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  photoPublicId?: string;
  personalQrCode?: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  isFirstTimer: boolean;
};

type LeaderboardStatDoc = {
  _id: { toString(): string };
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  playerId: {
    _id: { toString(): string };
    firstName: string;
    lastName: string;
    email?: string;
    photoUrl?: string;
    photoPublicId?: string;
    personalQrCode?: string;
  } | null;
};

export async function loadGameLeaderboardRecap(gameId: string): Promise<{
  rows: GameLeaderboardRecapRow[];
  insights: SessionInsight[];
}> {
  const [stats, matches, game] = await Promise.all([
    LeaderboardStats.find({ gameId }).sort({ wins: -1, winRate: -1 }).populate("playerId"),
    MatchHistory.find({ gameId })
      .sort({ endedAt: 1 })
      .populate(["teamAPlayerIds", "teamBPlayerIds"]),
    PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId?: { toString(): string } }>(),
  ]);

  const ownerId = game?.ownerId?.toString();
  const firstTimerIdentityKeys =
    ownerId != null
      ? await getSessionInsightIdentityKeys(ownerId, gameId, "new")
      : new Set<string>();

  const safeStats = (stats as unknown as LeaderboardStatDoc[]).filter((item) =>
    Boolean(item.playerId),
  );

  const rows: GameLeaderboardRecapRow[] = safeStats.map((item) => {
    const player = item.playerId!;
    const identityKey = getPlayerIdentityKey({
      _id: player._id,
      email: player.email,
      firstName: player.firstName,
      lastName: player.lastName,
    });

    return {
      id: String(item._id),
      playerId: String(player._id),
      firstName: player.firstName,
      lastName: player.lastName,
      photoUrl: player.photoUrl,
      photoPublicId: player.photoPublicId,
      personalQrCode: player.personalQrCode,
      wins: item.wins,
      losses: item.losses,
      gamesPlayed: item.gamesPlayed,
      winRate: item.winRate,
      currentStreak: item.currentStreak,
      isFirstTimer: firstTimerIdentityKeys.has(identityKey),
    };
  });

  const insights = computeSessionInsights(
    matches.map((m) => ({
      endedAt: m.endedAt,
      courtNumber: m.courtNumber,
      teamAPlayerIds: m.teamAPlayerIds,
      teamBPlayerIds: m.teamBPlayerIds,
      winnerTeam: m.winnerTeam,
      teamAScore: m.teamAScore,
      teamBScore: m.teamBScore,
      durationSeconds: m.durationSeconds,
    })),
    safeStats.map((row) => ({
      playerId: String(row.playerId!._id),
      name: formatPlayerTableName(row.playerId!.firstName, row.playerId!.lastName),
      firstName: row.playerId!.firstName,
      lastName: row.playerId!.lastName,
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

  return { rows, insights };
}
