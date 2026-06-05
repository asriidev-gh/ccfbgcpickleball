const storageKey = (gameId: string) => `ccf-queue-highlight-player:${gameId}`;
const activeHighlightKey = (gameId: string) => `ccf-queue-highlight-active:${gameId}`;

function readActiveHighlightRaw(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(activeHighlightKey(gameId));
}

function writeActiveHighlightRaw(gameId: string, raw: string | null) {
  if (typeof window === "undefined") return;
  const key = activeHighlightKey(gameId);
  if (raw == null) {
    sessionStorage.removeItem(key);
    return;
  }
  sessionStorage.setItem(key, raw);
}

/** Avoid re-running highlight on React Strict Mode remount or queue refetch. */
const appliedHighlightGames = new Set<string>();

/** Remember which player to highlight after registration → game queue. */
export function setQueueHighlightPlayerId(gameId: string, playerId: string) {
  if (typeof window === "undefined") return;
  appliedHighlightGames.delete(gameId);
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

function isVisibleElement(element: HTMLElement) {
  if (element.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

/** Scroll to a queue row that is actually visible on screen. */
export function scrollToQueueEntry(entryId: string): boolean {
  if (typeof document === "undefined") return false;
  const selector = `#queue-entry-${CSS.escape(String(entryId))}`;
  const nodes = document.querySelectorAll(selector);
  const visible = [...nodes].filter(
    (node): node is HTMLElement => node instanceof HTMLElement && isVisibleElement(node),
  );
  if (visible.length === 0) return false;

  const target =
    visible.find((element) => element.closest('[role="tabpanel"]')) ??
    visible.find((element) => !element.closest(".hidden")) ??
    visible[0];

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

/** Tied to the browser tab session — cleared when the tab or browser closes. */
export function persistActiveQueueHighlight(gameId: string, playerId: string) {
  if (typeof window === "undefined") return;
  const raw = readActiveHighlightRaw(gameId);
  const normalized = playerId.trim();
  if (!normalized) return;
  const ids = parseActiveHighlightIds(raw);
  if (!ids.includes(normalized)) ids.push(normalized);
  writeActiveHighlightRaw(gameId, JSON.stringify(ids));
}

export function getActiveQueueHighlightPlayerId(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  const ids = getActiveQueueHighlightPlayerIds(gameId);
  return ids.length > 0 ? ids[ids.length - 1] : null;
}

export function getActiveQueueHighlightPlayerIds(gameId: string): string[] {
  if (typeof window === "undefined") return [];
  return parseActiveHighlightIds(readActiveHighlightRaw(gameId));
}

export function removeActiveQueueHighlightPlayerId(gameId: string, playerId: string) {
  if (typeof window === "undefined") return;
  const normalized = playerId.trim();
  if (!normalized) return;
  const next = getActiveQueueHighlightPlayerIds(gameId).filter((id) => id !== normalized);
  if (next.length === 0) {
    writeActiveHighlightRaw(gameId, null);
    return;
  }
  writeActiveHighlightRaw(gameId, JSON.stringify(next));
}

export function clearActiveQueueHighlight(gameId: string) {
  if (typeof window === "undefined") return;
  writeActiveHighlightRaw(gameId, null);
}

/** Move pre-sessionStorage linked-player data into the tab session, then drop localStorage. */
export function migrateLegacyActiveHighlightToSession(gameId: string) {
  if (typeof window === "undefined" || !gameId) return;
  const key = activeHighlightKey(gameId);
  const legacy = localStorage.getItem(key);
  if (!legacy) return;
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, legacy);
  }
  localStorage.removeItem(key);
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
