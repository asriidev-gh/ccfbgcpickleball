const storageKey = (gameId: string) => `ccf-queue-highlight-player:${gameId}`;
const activeHighlightKey = (gameId: string) => `ccf-queue-highlight-active:${gameId}`;

/** Avoid re-running highlight on React Strict Mode remount or queue refetch. */
const appliedHighlightGames = new Set<string>();

/** Remember which player to highlight after registration → game queue. */
export function setQueueHighlightPlayerId(gameId: string, playerId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(storageKey(gameId), playerId);
}

export function peekQueueHighlightPlayerId(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(storageKey(gameId));
}

export function clearQueueHighlightPlayerId(gameId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey(gameId));
}

export function queueEntryPlayerId(entry: { playerId: { _id?: string | { toString(): string } } }) {
  const id = entry.playerId._id;
  if (id == null) return "";
  return typeof id === "string" ? id : id.toString();
}

export function markQueueHighlightApplied(gameId: string) {
  appliedHighlightGames.add(gameId);
}

export function hasQueueHighlightBeenApplied(gameId: string) {
  return appliedHighlightGames.has(gameId);
}

/** Keeps self-registration highlight until the player clears browser data for this site. */
export function persistActiveQueueHighlight(gameId: string, playerId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(activeHighlightKey(gameId), playerId);
}

export function getActiveQueueHighlightPlayerId(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(activeHighlightKey(gameId));
}

export function clearActiveQueueHighlight(gameId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(activeHighlightKey(gameId));
}
