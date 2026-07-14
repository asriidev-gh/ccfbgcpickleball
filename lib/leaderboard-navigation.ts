/** Operator / host dashboard — back link returns to `/games/{id}`. */
export function buildOperatorLeaderboardHref(gameId: string) {
  return `/leaderboard/${gameId}`;
}

export function buildSpectatorLeaderboardHref(
  gameId: string,
  options?: { returnGameId?: string },
) {
  const params = new URLSearchParams({ from: "spectator" });
  const returnGameId = options?.returnGameId?.trim();
  if (returnGameId) {
    params.set("returnGame", returnGameId);
  }
  return `/leaderboard/${gameId}?${params.toString()}`;
}

export function buildGameHistoryLeaderboardHref(pastGameId: string, currentGameId: string) {
  return buildSpectatorLeaderboardHref(pastGameId, { returnGameId: currentGameId });
}

export function parseSpectatorLeaderboardReturnGameId(
  returnGame: string | null | undefined,
) {
  const value = returnGame?.trim();
  return value || undefined;
}

export function getLeaderboardGameIdFromPath(pathname: string) {
  const match = pathname.match(/^\/leaderboard\/([^/]+)/);
  return match?.[1] ?? null;
}

/** Player menu game id on spectator routes (current session, not the viewed past leaderboard). */
export function getSpectatorMenuGameId(
  pathname: string,
  fromParam: string | null | undefined,
  returnGameParam: string | null | undefined,
) {
  const spectateMatch = pathname.match(/^\/games\/([^/]+)\/spectate(?:\/.*)?$/);
  if (spectateMatch?.[1]) return spectateMatch[1];

  const leaderboardGameId = getLeaderboardGameIdFromPath(pathname);
  if (leaderboardGameId && fromParam === "spectator") {
    return parseSpectatorLeaderboardReturnGameId(returnGameParam) ?? leaderboardGameId;
  }

  return null;
}

/** Club profile / branding target on spectator routes (the game being viewed). */
export function getSpectatorViewedGameId(
  pathname: string,
  fromParam: string | null | undefined,
) {
  const spectateMatch = pathname.match(/^\/games\/([^/]+)\/spectate(?:\/.*)?$/);
  if (spectateMatch?.[1]) return spectateMatch[1];

  const leaderboardGameId = getLeaderboardGameIdFromPath(pathname);
  if (leaderboardGameId && fromParam === "spectator") return leaderboardGameId;

  return null;
}
