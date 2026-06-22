import type { OperatorFullPayload } from "@/lib/operator-payload";
import type { OwnerCourtsViewSession } from "@/lib/owner-courts-view-payload";

export function operatorPayloadToCourtsViewSession(
  payload: OperatorFullPayload,
): OwnerCourtsViewSession {
  return {
    gameId: payload.game.gameId,
    title: payload.game.title,
    openPlayType: payload.game.openPlayType,
    courtCount: payload.game.courtCount,
    status: payload.game.status,
    openPlayDate: payload.game.openPlayDate ?? null,
    openPlayTimeRange: payload.game.openPlayTimeRange ?? null,
    courts: payload.courts,
    queue: payload.queue,
    leaderboard: payload.leaderboard ?? [],
  };
}

export function listActiveLocalCourtsViewSessions(
  sessions: Record<string, OperatorFullPayload>,
): OwnerCourtsViewSession[] {
  return Object.values(sessions)
    .filter((payload) => payload.game.status === "active")
    .map(operatorPayloadToCourtsViewSession);
}

export function mergeCourtsViewSessions(
  apiSessions: OwnerCourtsViewSession[],
  localSessions: OwnerCourtsViewSession[],
): OwnerCourtsViewSession[] {
  const apiIds = new Set(apiSessions.map((session) => session.gameId));
  const localById = new Map(localSessions.map((session) => [session.gameId, session]));

  const mergedApi = apiSessions.map((session) => localById.get(session.gameId) ?? session);
  const localOnly = localSessions.filter((session) => !apiIds.has(session.gameId));

  return [...localOnly, ...mergedApi];
}
