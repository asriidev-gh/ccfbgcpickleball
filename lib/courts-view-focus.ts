import { isEphemeralQuickGame } from "@/lib/local-game-id";

export const COURTS_VIEW_FOCUS_GAME_ID_PARAM = "gameId";

export function ephemeralCourtsViewHref(gameId: string) {
  return `/play/${gameId}/courts-view`;
}

export function courtsViewHref(focusGameId?: string) {
  if (!focusGameId) return "/my-games/courts-view";
  if (isEphemeralQuickGame(focusGameId)) {
    return ephemeralCourtsViewHref(focusGameId);
  }
  return `/my-games/courts-view?${COURTS_VIEW_FOCUS_GAME_ID_PARAM}=${encodeURIComponent(focusGameId)}`;
}

export function spectatorCourtsViewHref(gameId: string) {
  return `/games/${gameId}/spectate/courts-view`;
}

export function hiddenCourtsViewSessionIdsForFocus(
  sessions: readonly { gameId: string }[],
  focusGameId: string,
): Set<string> {
  return new Set(
    sessions.map((session) => session.gameId).filter((gameId) => gameId !== focusGameId),
  );
}
