import type { QueryClient } from "@tanstack/react-query";

import type { GamePayload } from "@/lib/game-payload-mutations";
import { operatorPayloadToCourtsViewSession } from "@/lib/local-courts-view";
import type { OwnerCourtsViewPayload, OwnerCourtsViewSession } from "@/lib/owner-courts-view-payload";

export const COURTS_VIEW_QUERY_KEY = ["games", "courts-view"] as const;

export function isCourtsViewQueryKey(key: readonly unknown[]): boolean {
  return key.length >= 2 && key[0] === "games" && key[1] === "courts-view";
}

function courtsViewSessionToGamePayload(session: OwnerCourtsViewSession): GamePayload {
  return {
    game: {
      gameId: session.gameId,
      title: session.title,
      openPlayType: session.openPlayType,
      courtCount: session.courtCount,
      status: session.status,
      openPlayDate: session.openPlayDate ?? null,
      openPlayTimeRange: session.openPlayTimeRange ?? null,
      gameMode: session.gameMode ?? "doubles",
      matchingType: session.matchingType,
    },
    queue: session.queue,
    checkedOut: session.checkedOut ?? [],
    courts: session.courts,
    leaderboard: session.leaderboard,
    matches: [],
  };
}

export function readCourtsViewGamePayload(
  queryClient: QueryClient,
  gameId: string,
): GamePayload | undefined {
  const payload = queryClient.getQueryData<OwnerCourtsViewPayload>(COURTS_VIEW_QUERY_KEY);
  const session = payload?.sessions.find((item) => item.gameId === gameId);
  if (!session) return undefined;
  return courtsViewSessionToGamePayload(session);
}

export function writeCourtsViewGamePayload(
  queryClient: QueryClient,
  gameId: string,
  next: GamePayload,
) {
  const payload = queryClient.getQueryData<OwnerCourtsViewPayload>(COURTS_VIEW_QUERY_KEY);
  if (!payload) return;

  const nextSession = operatorPayloadToCourtsViewSession(next);
  queryClient.setQueryData<OwnerCourtsViewPayload>(COURTS_VIEW_QUERY_KEY, {
    sessions: payload.sessions.map((session) =>
      session.gameId === gameId ? nextSession : session,
    ),
  });
}
