import { computeSessionInsights, type SessionInsight } from "@/lib/session-insights";
import { formatPlayerTableName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import "@/models/Player";

export type GameLeaderboardRecapRow = {
  id: string;
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
    photoUrl?: string;
    photoPublicId?: string;
    personalQrCode?: string;
  } | null;
};

export async function loadGameLeaderboardRecap(gameId: string): Promise<{
  rows: GameLeaderboardRecapRow[];
  insights: SessionInsight[];
}> {
  const [stats, matches] = await Promise.all([
    LeaderboardStats.find({ gameId }).sort({ wins: -1, winRate: -1 }).populate("playerId"),
    MatchHistory.find({ gameId })
      .sort({ endedAt: 1 })
      .populate(["teamAPlayerIds", "teamBPlayerIds"]),
  ]);

  const safeStats = (stats as unknown as LeaderboardStatDoc[]).filter((item) =>
    Boolean(item.playerId),
  );

  const rows: GameLeaderboardRecapRow[] = safeStats.map((item) => ({
    id: String(item._id),
    firstName: item.playerId!.firstName,
    lastName: item.playerId!.lastName,
    photoUrl: item.playerId!.photoUrl,
    photoPublicId: item.playerId!.photoPublicId,
    personalQrCode: item.playerId!.personalQrCode,
    wins: item.wins,
    losses: item.losses,
    gamesPlayed: item.gamesPlayed,
    winRate: item.winRate,
    currentStreak: item.currentStreak,
  }));

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
