import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { LeaderboardGamesPlayedRow } from "@/lib/games-played-map";
import type { OperatorQueuePayload } from "@/lib/operator-payload";
import { resolvePlayerId } from "@/lib/resolve-player-id";

function queueEntryFingerprint(entry: QueueEntryView) {
  const playerId = resolvePlayerId(entry.playerId) ?? "";
  return [
    entry._id,
    playerId,
    entry.registeredAt,
    entry.queueType,
    entry.lockInGroupId ?? "",
    entry.lastMatchResult,
    entry.cardSharedAt ?? "",
    entry.wins ?? "",
    entry.losses ?? "",
    entry.gamesPlayed ?? "",
    entry.playerId.photoUrl ?? "",
    entry.playerId.photoPublicId ?? "",
  ].join(":");
}

function courtFingerprint(court: CourtView) {
  const team = (players: CourtView["teamA"]["playerIds"]) =>
    players.map((player) => resolvePlayerId(player) ?? "").join(",");
  return [
    court.courtNumber,
    court.status,
    court.startedAt ?? "",
    court.pausedAt ?? "",
    court.totalPausedMs ?? 0,
    court.isRematch ? 1 : 0,
    team(court.teamA?.playerIds ?? []),
    team(court.teamB?.playerIds ?? []),
  ].join(":");
}

function leaderboardFingerprint(row: LeaderboardGamesPlayedRow) {
  const playerId =
    typeof row.playerId === "object" && row.playerId != null && "_id" in row.playerId
      ? String(row.playerId._id)
      : String(row.playerId ?? "");
  return `${playerId}:${row.gamesPlayed}:${row.wins}:${row.losses}`;
}

export function operatorQueueSyncFingerprint(payload: OperatorQueuePayload) {
  return [
    payload.status,
    payload.firstTimerCount ?? 0,
    payload.birthdayThisMonthCount ?? 0,
    payload.queue.map(queueEntryFingerprint).join("|"),
    payload.checkedOut.map((entry) => entry._id).join(","),
    payload.courts.map(courtFingerprint).join("|"),
    (payload.leaderboard ?? []).map(leaderboardFingerprint).join("|"),
  ].join("#");
}

/** Keep the previous payload object when a poll/refetch found no visible changes. */
export function reuseUnchangedOperatorQueue(
  previous: OperatorQueuePayload | undefined,
  next: OperatorQueuePayload,
): OperatorQueuePayload {
  if (previous && operatorQueueSyncFingerprint(previous) === operatorQueueSyncFingerprint(next)) {
    return previous;
  }
  return next;
}
