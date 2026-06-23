import { LOCAL_SESSION_PLAYER_ID_PREFIX } from "@/lib/local-game-session";

export function isLocalSessionPlayerId(playerId: string | null | undefined) {
  return typeof playerId === "string" && playerId.startsWith(LOCAL_SESSION_PLAYER_ID_PREFIX);
}

/** MongoDB ObjectId string — safe to pass to server player lookups. */
export function isPersistedPlayerId(playerId: string | null | undefined) {
  if (!playerId || isLocalSessionPlayerId(playerId)) return false;
  return /^[a-f\d]{24}$/i.test(playerId);
}
