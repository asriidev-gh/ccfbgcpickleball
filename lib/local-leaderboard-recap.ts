import type { PlayerPhotoRef } from "@/components/game/player-avatar";
import { resolvePlayerId } from "@/components/game/player-avatar";
import type { MatchHistoryView } from "@/components/game/match-history-list";
import type { GameLeaderboardRecapRow } from "@/lib/game-leaderboard-recap";
import type { LeaderboardRecapPayload } from "@/lib/fetch-leaderboard";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { computeSessionInsights, type SessionStatRow } from "@/lib/session-insights";
import { formatPlayerTableName } from "@/lib/utils";

function leaderboardRowPlayerId(row: LeaderboardGamesPlayedRow): string | null {
  const playerId = row.playerId;
  if (playerId == null) return null;
  if (typeof playerId === "object" && "_id" in playerId && playerId._id != null) {
    return String(playerId._id);
  }
  return String(playerId);
}

function collectSessionPlayers(payload: OperatorFullPayload): Map<string, PlayerPhotoRef> {
  const players = new Map<string, PlayerPhotoRef>();

  const addPlayer = (player: PlayerPhotoRef) => {
    const id = resolvePlayerId(player);
    if (id) players.set(id, player);
  };

  for (const entry of [...payload.queue, ...payload.checkedOut]) {
    addPlayer(entry.playerId);
  }

  for (const court of payload.courts) {
    for (const player of [...court.teamA.playerIds, ...court.teamB.playerIds]) {
      addPlayer(player);
    }
  }

  for (const match of payload.matches ?? []) {
    for (const player of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
      if (!player || typeof player !== "object") continue;
      addPlayer({
        _id: resolvePlayerId(player) ?? undefined,
        firstName: player.firstName ?? "",
        lastName: player.lastName ?? "",
        photoUrl: player.photoUrl,
        photoPublicId: player.photoPublicId,
        personalQrCode: player.personalQrCode,
      });
    }
  }

  return players;
}

function computeCurrentStreak(playerId: string, matches: MatchHistoryView[]) {
  const sorted = [...matches].sort(
    (left, right) => new Date(left.endedAt).getTime() - new Date(right.endedAt).getTime(),
  );

  let streak = 0;
  for (const match of sorted) {
    const onTeamA = match.teamAPlayerIds.some((player) => resolvePlayerId(player) === playerId);
    const onTeamB = match.teamBPlayerIds.some((player) => resolvePlayerId(player) === playerId);
    if (!onTeamA && !onTeamB) continue;

    const won =
      (match.winnerTeam === "A" && onTeamA) || (match.winnerTeam === "B" && onTeamB);
    streak += won ? 1 : -1;
  }

  return streak;
}

export function buildLocalLeaderboardRecap(payload: OperatorFullPayload): LeaderboardRecapPayload {
  if (payload.recap) {
    return payload.recap;
  }

  const players = collectSessionPlayers(payload);
  const matches = payload.matches ?? [];
  const leaderboard = payload.leaderboard ?? [];

  const rows: GameLeaderboardRecapRow[] = [];

  for (const row of leaderboard) {
    const playerId = leaderboardRowPlayerId(row);
    if (!playerId) continue;

    const player = players.get(playerId);
    const wins = row.wins ?? 0;
    const losses = row.losses ?? 0;
    const gamesPlayed = row.gamesPlayed ?? wins + losses;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;

    rows.push({
      id: playerId,
      firstName: player?.firstName ?? "",
      lastName: player?.lastName ?? "",
      photoUrl: player?.photoUrl ?? undefined,
      photoPublicId: player?.photoPublicId ?? undefined,
      personalQrCode: player?.personalQrCode,
      wins,
      losses,
      gamesPlayed,
      winRate,
      currentStreak: computeCurrentStreak(playerId, matches),
      isFirstTimer: false,
    });
  }

  rows.sort((left, right) => {
    if (right.wins !== left.wins) return right.wins - left.wins;
    return right.winRate - left.winRate;
  });

  const statRows: SessionStatRow[] = rows.map((row) => ({
    playerId: row.id,
    name: formatPlayerTableName(row.firstName, row.lastName),
    firstName: row.firstName,
    lastName: row.lastName,
    photoUrl: row.photoUrl,
    photoPublicId: row.photoPublicId,
    personalQrCode: row.personalQrCode,
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
    losses: row.losses,
    winRate: row.winRate,
    currentStreak: row.currentStreak,
  }));

  const insights = computeSessionInsights(
    matches.map((match) => ({
      endedAt: match.endedAt,
      courtNumber: match.courtNumber,
      teamAPlayerIds: match.teamAPlayerIds,
      teamBPlayerIds: match.teamBPlayerIds,
      winnerTeam: match.winnerTeam,
      teamAScore: match.teamAScore,
      teamBScore: match.teamBScore,
      durationSeconds: match.durationSeconds,
    })),
    statRows,
  );

  return { rows, insights };
}
