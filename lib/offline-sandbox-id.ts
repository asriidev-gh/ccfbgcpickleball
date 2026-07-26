export const OFFLINE_SANDBOX_GAME_ID_PREFIX = "of_";

function createOfflineSandboxId() {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${OFFLINE_SANDBOX_GAME_ID_PREFIX}${suffix}`;
}

export function createOfflineSandboxGameId() {
  return createOfflineSandboxId();
}

export function isOfflineSandboxGame(gameId: string | null | undefined) {
  return Boolean(gameId?.startsWith(OFFLINE_SANDBOX_GAME_ID_PREFIX));
}

export function getOfflineSandboxDashboardPath(gameId: string) {
  return `/offline/${gameId}`;
}
