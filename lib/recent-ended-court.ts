import type { CourtView } from "@/components/game/court-card";
import type { OperatorQueuePayload } from "@/lib/operator-payload";
import { resolvePlayerId } from "@/lib/resolve-player-id";

const RECENT_END_GUARD_MS = 20_000;

type RecentEndedCourt = {
  playerIds: Set<string>;
  rememberedAt: number;
};

const recentEndedCourts = new Map<string, RecentEndedCourt>();

function endedCourtKey(gameId: string, courtNumber: number) {
  return `${gameId}:${courtNumber}`;
}

export function isAlreadyClearedCourtError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message === "Active court not found.";
}

export function playerIdsOnCourt(court: Pick<CourtView, "teamA" | "teamB">) {
  return [...(court.teamA?.playerIds ?? []), ...(court.teamB?.playerIds ?? [])]
    .map((player) => resolvePlayerId(player))
    .filter((id): id is string => Boolean(id));
}

export function rememberEndedCourt(gameId: string, courtNumber: number, playerIds: string[]) {
  if (!gameId || playerIds.length === 0) return;
  recentEndedCourts.set(endedCourtKey(gameId, courtNumber), {
    playerIds: new Set(playerIds),
    rememberedAt: Date.now(),
  });
}

export function applyRecentEndCourtGuard(
  gameId: string,
  payload: OperatorQueuePayload,
): OperatorQueuePayload {
  if (!gameId || recentEndedCourts.size === 0) return payload;

  const now = Date.now();
  let changed = false;
  const courts = payload.courts.map((court) => {
    const key = endedCourtKey(gameId, court.courtNumber);
    const remembered = recentEndedCourts.get(key);
    if (!remembered) return court;

    if (now - remembered.rememberedAt > RECENT_END_GUARD_MS) {
      recentEndedCourts.delete(key);
      return court;
    }

    if (court.status !== "active") {
      recentEndedCourts.delete(key);
      return court;
    }

    const currentIds = playerIdsOnCourt(court);
    const sameFinishedPlayers =
      currentIds.length > 0 &&
      currentIds.length === remembered.playerIds.size &&
      currentIds.every((id) => remembered.playerIds.has(id));

    if (!sameFinishedPlayers) {
      recentEndedCourts.delete(key);
      return court;
    }

    changed = true;
    return {
      ...court,
      status: "empty" as const,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      isRematch: false,
      teamA: { playerIds: [] },
      teamB: { playerIds: [] },
    };
  });

  return changed ? { ...payload, courts } : payload;
}
