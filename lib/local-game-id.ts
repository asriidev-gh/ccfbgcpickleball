export const ACCOUNT_QUICK_GAME_ID_PREFIX = "lg_";
export const EPHEMERAL_QUICK_GAME_ID_PREFIX = "qp_";

/** @deprecated Use ACCOUNT_QUICK_GAME_ID_PREFIX */
export const LOCAL_LIVE_QUEUE_GAME_ID_PREFIX = ACCOUNT_QUICK_GAME_ID_PREFIX;

export type QuickGamePersistence = "account" | "ephemeral";

function createQuickGameId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}${suffix}`;
}

/** Logged-in quick game — may be saved to QuickGameSession collection. */
export function createAccountQuickGameId() {
  return createQuickGameId(ACCOUNT_QUICK_GAME_ID_PREFIX);
}

/** @deprecated Use createAccountQuickGameId */
export function createLocalLiveQueueGameId() {
  return createAccountQuickGameId();
}

/** Public browser-only quick game — never saved to the database. */
export function createEphemeralQuickGameId() {
  return createQuickGameId(EPHEMERAL_QUICK_GAME_ID_PREFIX);
}

export function isAccountQuickGame(gameId: string | null | undefined) {
  return Boolean(gameId?.startsWith(ACCOUNT_QUICK_GAME_ID_PREFIX));
}

/** @deprecated Use isAccountQuickGame */
export function isLocalLiveQueueGame(gameId: string | null | undefined) {
  return isAccountQuickGame(gameId);
}

export function isEphemeralQuickGame(gameId: string | null | undefined) {
  return Boolean(gameId?.startsWith(EPHEMERAL_QUICK_GAME_ID_PREFIX));
}

export function isQuickGame(gameId: string | null | undefined) {
  return isAccountQuickGame(gameId) || isEphemeralQuickGame(gameId);
}

export function getQuickGamePersistence(
  gameId: string | null | undefined,
): QuickGamePersistence | null {
  if (isAccountQuickGame(gameId)) return "account";
  if (isEphemeralQuickGame(gameId)) return "ephemeral";
  return null;
}

export function getQuickGameDashboardPath(gameId: string) {
  return isEphemeralQuickGame(gameId) ? `/play/${gameId}` : `/games/${gameId}`;
}
