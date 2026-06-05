import { migrateLegacyActiveHighlightToSession } from "@/lib/queue-highlight";

const queueHighlightPlayerKey = (gameId: string) => `ccf-queue-highlight-player:${gameId}`;
const queueHighlightActiveKey = (gameId: string) => `ccf-queue-highlight-active:${gameId}`;
const spectatorPresenceKey = (gameId: string) => `spectator-presence-${gameId}`;
const spectatorCheckoutReadKey = (gameId: string) => `ccf-spectator-checkout-read:${gameId}`;

/** Legacy localStorage key — cleared after migrating into sessionStorage. */
const legacyQueueHighlightActiveKey = (gameId: string) => `ccf-queue-highlight-active:${gameId}`;

export function clearSpectatorGameStorage(gameId: string) {
  if (typeof window === "undefined" || !gameId) return;

  sessionStorage.removeItem(queueHighlightPlayerKey(gameId));
  sessionStorage.removeItem(queueHighlightActiveKey(gameId));
  sessionStorage.removeItem(spectatorPresenceKey(gameId));
  sessionStorage.removeItem(spectatorCheckoutReadKey(gameId));

  localStorage.removeItem(legacyQueueHighlightActiveKey(gameId));
}

export function migrateLegacySpectatorLocalStorage(gameId: string) {
  migrateLegacyActiveHighlightToSession(gameId);
}
