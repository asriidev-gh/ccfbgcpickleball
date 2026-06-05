import {
  getActiveQueueHighlightPlayerId,
  peekQueueHighlightPlayerId,
} from "@/lib/queue-highlight";

/** Player linked to this open play in the current browser tab session. */
export function getLinkedPlayerIdForGame(gameId: string): string | null {
  if (!gameId) return null;
  return getActiveQueueHighlightPlayerId(gameId) ?? peekQueueHighlightPlayerId(gameId);
}

export function getSpectateGameIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/games\/([^/]+)\/spectate(?:\/.*)?$/);
  return match?.[1] ?? null;
}
