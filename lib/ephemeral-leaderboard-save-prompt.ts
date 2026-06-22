function dismissSessionKey(gameId: string) {
  return `ccf-ephemeral-leaderboard-save-dismiss:${gameId}`;
}

export function isEphemeralLeaderboardSaveDismissedForSession(gameId: string) {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(dismissSessionKey(gameId)) === "1";
}

export function dismissEphemeralLeaderboardSaveForSession(gameId: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(dismissSessionKey(gameId), "1");
}
