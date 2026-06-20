export const COURTS_VIEW_FOCUS_GAME_ID_PARAM = "gameId";

export function courtsViewHref(focusGameId?: string) {
  if (!focusGameId) return "/my-games/courts-view";
  return `/my-games/courts-view?${COURTS_VIEW_FOCUS_GAME_ID_PARAM}=${encodeURIComponent(focusGameId)}`;
}

export function hiddenCourtsViewSessionIdsForFocus(
  sessions: readonly { gameId: string }[],
  focusGameId: string,
): Set<string> {
  return new Set(
    sessions.map((session) => session.gameId).filter((gameId) => gameId !== focusGameId),
  );
}
