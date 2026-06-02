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
  const key = activeHighlightKey(gameId);
  const raw = localStorage.getItem(key);
  const normalized = playerId.trim();
  if (!normalized) return;
  const ids = parseActiveHighlightIds(raw);
  if (!ids.includes(normalized)) ids.push(normalized);
  localStorage.setItem(key, JSON.stringify(ids));
}

export function getActiveQueueHighlightPlayerId(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  const ids = getActiveQueueHighlightPlayerIds(gameId);
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

export function getActiveQueueHighlightPlayerIds(gameId: string): string[] {
  if (typeof window === "undefined") return [];
  return parseActiveHighlightIds(localStorage.getItem(activeHighlightKey(gameId)));
}

export function removeActiveQueueHighlightPlayerId(gameId: string, playerId: string) {
  if (typeof window === "undefined") return;
  const normalized = playerId.trim();
  if (!normalized) return;
  const key = activeHighlightKey(gameId);
  const next = getActiveQueueHighlightPlayerIds(gameId).filter((id) => id !== normalized);
  if (next.length === 0) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(next));
}

export function clearActiveQueueHighlight(gameId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(activeHighlightKey(gameId));
}

function parseActiveHighlightIds(raw: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("[")) return [trimmed];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}
